from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    Token,
    LoginRequest,
    RefreshRequest,
    RegistrationResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.utils.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.models.email_verification import EmailVerification
from app.models.password_reset import PasswordReset
from app.utils.email import send_verification_email, send_password_reset_email
from datetime import datetime, timedelta, timezone
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------- REGISTER ROUTE ---------------- #
@router.post("/register", response_model=RegistrationResponse)
async def register(user_data: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # ---- Basic field validation ----
    if not user_data.name or not user_data.name.strip():
        raise HTTPException(status_code=400, detail="User name cannot be empty")
    if not user_data.email or not user_data.email.strip():
        raise HTTPException(status_code=400, detail="Email cannot be empty")
    if not user_data.password or not user_data.password.strip():
        raise HTTPException(status_code=400, detail="Password cannot be empty")
    if not user_data.department or not user_data.department.strip():
        raise HTTPException(status_code=400, detail="Department cannot be empty")

    # ---- Check if user already exists ----
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # ---- Validate role ----
    if hasattr(user_data, "role"):  # Optional: if role exists in schema
        if user_data.role not in ["admin", "employee"]:
            raise HTTPException(status_code=400, detail="Invalid role specified. Use 'admin' or 'employee'.")
    else:
        user_data.role = "employee"  # default role if not provided

    # ---- Hash password ----
    hashed_password = get_password_hash(user_data.password)

    # ---- Create and save new user (unverified/inactive) ----
    new_user = User(
        name=user_data.name.strip(),
        email=user_data.email.strip().lower(),
        hashed_password=hashed_password,  # ✅ Correct field name
        department=user_data.department.strip(),
        role=user_data.role,  # ✅ persist role so admin guard works
        is_admin=(user_data.role == "admin"),  # kept for backward compatibility
        is_active=False
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # ---- Create email verification token ----
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    verification = EmailVerification(
        user_id=new_user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(verification)
    db.commit()

    # ---- Send verification email in background ----
    background_tasks.add_task(send_verification_email, new_user.email, new_user.name, token)

    return {"message": "Registration successful. Please check your email to verify your account.", "requires_verification": True}


# ---------------- LOGIN ROUTE ---------------- #
@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()

    # ---- Verify user credentials ----
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # ---- Generate tokens ----
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# ---------------- REFRESH TOKEN ROUTE ---------------- #
@router.post("/refresh", response_model=Token)
async def refresh(refresh_data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(refresh_data.refresh_token)

    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # ---- Generate new tokens ----
    access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


# ---------------- VERIFY EMAIL VIA TOKEN ---------------- #
@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    verification = db.query(EmailVerification).filter(EmailVerification.token == token).first()
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    if verification.consumed:
        return {"message": "Email already verified"}

    now = datetime.now(timezone.utc)
    if verification.expires_at < now:
        raise HTTPException(status_code=400, detail="Verification token has expired")

    user = db.query(User).filter(User.id == verification.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    verification.consumed = True
    verification.consumed_at = now
    db.commit()

    return {"message": "Email verified successfully. You can now log in."}


# ---------------- FORGOT PASSWORD ---------------- #
@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    # Always return generic message to prevent user enumeration
    generic_response = {"message": "If that email exists, a reset link has been sent."}
    if not user:
        return generic_response

    # Create reset token (1 hour expiry)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset = PasswordReset(user_id=user.id, token=token, expires_at=expires_at)
    db.add(reset)
    db.commit()

    background_tasks.add_task(send_password_reset_email, user.email, user.name, token)
    return generic_response


# ---------------- RESET PASSWORD ---------------- #
@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset = db.query(PasswordReset).filter(PasswordReset.token == payload.token).first()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if reset.consumed:
        raise HTTPException(status_code=400, detail="Reset token already used")
    now = datetime.now(timezone.utc)
    if reset.expires_at < now:
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update password
    user.hashed_password = get_password_hash(payload.new_password)
    reset.consumed = True
    reset.consumed_at = now
    db.commit()

    return {"message": "Password has been reset successfully"}

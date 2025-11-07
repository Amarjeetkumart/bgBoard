from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, Token, LoginRequest, RefreshRequest
from app.utils.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------- REGISTER ROUTE ---------------- #
@router.post("/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
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

    # ---- Create and save new user ----
    new_user = User(
        name=user_data.name.strip(),
        email=user_data.email.strip().lower(),
        hashed_password=hashed_password,  # ✅ Correct field name
        department=user_data.department.strip(),
        is_admin=(user_data.role == "admin"),
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # ---- Generate tokens ----
    access_token = create_access_token(data={"sub": new_user.email})
    refresh_token = create_refresh_token(data={"sub": new_user.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


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

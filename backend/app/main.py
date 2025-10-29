from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, users, shoutouts, comments, reactions, admin

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Employee Recognition Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(shoutouts.router)
app.include_router(comments.router)
app.include_router(reactions.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    return {"message": "Employee Recognition Platform API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

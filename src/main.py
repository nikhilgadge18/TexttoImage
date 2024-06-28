import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional
import torch
from diffusers import StableDiffusionPipeline
from diffusers.models.modeling_outputs import Transformer2DModelOutput
from PIL import Image
import base64
from io import BytesIO
import io
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from rembg import remove

from src import models, schemas, crud
from src.database import SessionLocal, engine, Base, init_db

# Configuration class
class CFG:
    device = "cuda"
    seed = 42
    generator = torch.Generator(device).manual_seed(seed)
    image_gen_steps = 35
    image_gen_model_id = "stabilityai/stable-diffusion-2"
    image_gen_size = (400, 400)
    image_gen_guidance_scale = 9
    secret_key = "6ccc5c80687b138799df8e4292d6d358e2a68b6cf8d02d2b4eaea929288a06c5"
    algorithm = "HS256"
    access_token_expire_minutes = 30

# Request model for text prompts
class TextToImageRequest(BaseModel):
    text_prompts: List[str]

# Initialize the FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust according to your frontend's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model on startup
@app.on_event("startup")
async def startup_event():
    global image_gen_model
    image_gen_model = StableDiffusionPipeline.from_pretrained(
        CFG.image_gen_model_id, torch_dtype=torch.float32, variant="fp16"
    ).to(CFG.device)
    init_db()  # Initialize the database

# Unload the model on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    global image_gen_model
    del image_gen_model

# Generate image from prompt
def generate_image(prompt, model):
    image = model(
        prompt, num_inference_steps=CFG.image_gen_steps,
        generator=CFG.generator,
        guidance_scale=CFG.image_gen_guidance_scale
    ).images[0]
    image = image.resize(CFG.image_gen_size)
    return image

def remove_background(image: Image.Image) -> Image.Image:
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    # Remove background
    img_no_bg = remove(img_byte_arr)
    
    # Convert bytes back to image
    img_no_bg = Image.open(io.BytesIO(img_no_bg))
    return img_no_bg


# Convert image to base64 string
def image_to_base64(image: Image.Image) -> str:
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()

# Endpoint to generate images
@app.post("/generate-images/")
async def generate_images(request: TextToImageRequest):
    if not request.text_prompts:
        raise HTTPException(status_code=400, detail="No text prompts provided")
    
    images = []
    for prompt in request.text_prompts:
        with torch.no_grad():
            image = generate_image(prompt, image_gen_model)
            images.append(image_to_base64(image))
    return {"images": images}

@app.post("/remove-background/")
async def remove_background_endpoint(request: TextToImageRequest):
    if not request.text_prompts:
        raise HTTPException(status_code=400, detail="No text prompts provided")
    
    images = []
    for prompt in request.text_prompts:
        with torch.no_grad():
            image = generate_image(prompt, image_gen_model)
            # Remove the background
            image_no_bg = remove_background(image)
            images.append(image_to_base64(image_no_bg))
    return {"images": images}

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Security utilities
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def authenticate_user(db: Session, username: str, password: str):
    user = crud.get_user_by_username(db, username=username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, CFG.secret_key, algorithm=CFG.algorithm)
    return encoded_jwt

# User signup
@app.post("/signup", response_model=schemas.User)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    user.password = hashed_password
    return crud.create_user(db=db, user=user)

# User login
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=CFG.access_token_expire_minutes)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

# Get current user
@app.get("/users/me", response_model=schemas.User)
async def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, CFG.secret_key, algorithms=[CFG.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    return user

# Run the FastAPI app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

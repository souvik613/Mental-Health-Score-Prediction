import joblib
import pandas as pd
from typing import Literal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ---------------------------------------------------------------
# Input: frontend ya /docs theke ja pathabe
# Note: Gender ar Academic_Level e shudhu model jei value gulo diye
# train hoyechhe segulo rakha hoyeche (Other / Postgraduate model
# kokhono dekhe ni, tai tar prediction ortho-hin hoto).
# ---------------------------------------------------------------
class InputData(BaseModel):
    Age: int = Field(..., ge=10, le=100)
    Gender: Literal["Male", "Female"]
    Country: str
    Academic_Level: Literal["High School", "Undergraduate", "Graduate"]
    Most_Used_Platform: Literal[
        "Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter", "YouTube",
        "TikTok", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat",
    ]
    Purpose_Of_Use: Literal["Networking", "Education", "Entertainment", "News"]
    Avg_Daily_Usage_Hours: float = Field(..., ge=0, le=24)
    Daily_Unlocks: int = Field(..., ge=0)
    Study_Hours: int = Field(..., ge=0, le=24)
    Physical_Activity_Hours: int = Field(..., ge=0, le=24)
    Sleep_Hours_Per_Night: int = Field(..., ge=0, le=24)
    stress_level: Literal["Low", "Medium", "High", "Very High"]


# Response model (class hote hobe, def noy)
class PredictionResponse(BaseModel):
    predicted_mental_health_score: float


model = joblib.load("Mental_Health_Model.pkl")

app = FastAPI(title="Mental Health Score Predictor")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model training er somoy ei country gulo alada rakha hoyechhilo, baki sob "Other"
TOP_COUNTRIES = ["India", "USA", "Canada", "Australia", "UK",
                 "Germany", "Mexico", "Turkey", "France"]


@app.get("/")
def greet():
    return "Hello, World!"


@app.post("/predict", response_model=PredictionResponse)
def predict(data: InputData):
    country = data.Country.strip()
    grouped_country = country if country in TOP_COUNTRIES else "Other"

    # Column er nam hubohu training er moto hote hobe
    # (model e "Stress_Level" ar "Grouped_country" ache, "Country" nei)
    input_row = pd.DataFrame([{
        "Study_Hours": data.Study_Hours,
        "Age": data.Age,
        "Avg_Daily_Usage_Hours": data.Avg_Daily_Usage_Hours,
        "Daily_Unlocks": data.Daily_Unlocks,
        "Physical_Activity_Hours": data.Physical_Activity_Hours,
        "Sleep_Hours_Per_Night": data.Sleep_Hours_Per_Night,
        "Stress_Level": data.stress_level,
        "Gender": data.Gender,
        "Academic_Level": data.Academic_Level,
        "Most_Used_Platform": data.Most_Used_Platform,
        "Purpose_Of_Use": data.Purpose_Of_Use,
        "Grouped_country": grouped_country,
    }])

    prediction = model.predict(input_row)[0]
    return PredictionResponse(predicted_mental_health_score=round(float(prediction), 2))
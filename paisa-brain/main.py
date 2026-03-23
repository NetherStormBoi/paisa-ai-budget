from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🧠 Booting up Paisa AI Brain...")

# --- THE AI MEMORY BANK ---
training_data = [
    ("Starbucks coffee", "Food"),
    ("McDonalds burger", "Food"),
    ("Uber ride", "Transport"),
    ("Lyft trip", "Transport"),
    ("Amazon order", "Shopping"),
    ("Walmart groceries", "Shopping"),
    ("Netflix monthly", "Subscriptions"),
    ("Spotify premium", "Subscriptions"),
    ("Apartment Rent", "Housing"),
    ("Electricity bill", "Housing")
]

model = None

# We wrap the training in a function so we can call it again whenever we learn something new!
def train_model():
    global model
    X_train = [item[0] for item in training_data]
    y_train = [item[1] for item in training_data]
    
    model = Pipeline([
        ('vectorizer', TfidfVectorizer()),
        ('classifier', RandomForestClassifier(random_state=42))
    ])
    model.fit(X_train, y_train)

# Train the AI immediately when the server starts
train_model()
print("✅ AI is trained and ready!")

# --- API ENDPOINTS ---

@app.get("/predict")
def predict_category(description: str):
    prediction = model.predict([description])[0]
    return {"category": prediction}

# We create a specific format for the incoming learning data
class ExpenseData(BaseModel):
    description: str
    category: str

@app.post("/learn")
def learn_new_expense(data: ExpenseData):
    # 1. Add the new user data to the memory bank
    training_data.append((data.description, data.category))
    
    # 2. Re-train the AI instantly with the updated data
    train_model()
    
    print(f"🎓 AI Learned: '{data.description}' belongs to '{data.category}'")
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
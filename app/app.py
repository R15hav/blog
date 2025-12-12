from fastapi import FastAPI

app = FastAPI()

@app.get("/get-blogs")
def get_blogs():
    return {"message": "List of blogs"}
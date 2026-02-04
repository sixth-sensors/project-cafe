import msgpack
from fastapi import FastAPI, Request, Response

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/telemetry")
async def receive_msg(request: Request):
    msg = msgpack.unpackb(await request.body())
    print(f"Received: {msg}")
    return Response(
        content=msgpack.packb({"ack": True}), media_type="application/msgpack"
    )

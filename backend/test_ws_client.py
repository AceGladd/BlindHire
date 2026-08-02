import asyncio
import websockets
import json

async def run():
    uri = 'ws://127.0.0.1:8000/ws/interview'
    async with websockets.connect(uri) as ws:
        print('connected')
        await ws.send(json.dumps({'type':'start','voice':'male'}))
        with open('ws_client_output.log','w',encoding='utf-8') as f:
            for _ in range(6):
                msg = await ws.recv()
                f.write(msg + '\n')
                f.flush()

if __name__ == '__main__':
    asyncio.run(run())

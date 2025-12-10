import redis.asyncio as redis
from app.core.config import settings


class RedisService:
    def __init__(self):
        self.redis_client = None

    async def connect(self):
        self.redis_client = await redis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )

    async def disconnect(self):
        if self.redis_client:
            await self.redis_client.close()

    async def get(self, key: str):
        return await self.redis_client.get(key)

    async def set(self, key: str, value: str, expire: int = None):
        return await self.redis_client.set(key, value, ex=expire)

    async def delete(self, key: str):
        return await self.redis_client.delete(key)

    async def exists(self, key: str):
        return await self.redis_client.exists(key)


redis_service = RedisService()

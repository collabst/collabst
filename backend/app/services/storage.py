from typing import BinaryIO
from minio import Minio
from minio.error import S3Error
from app.core.config import settings


class StorageService:
    def __init__(self):
        print(settings.MINIO_ENDPOINT, settings.MINIO_PUBLIC_ENDPOINT)
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        print("Initialized MinIO client with endpoint:", settings.MINIO_ENDPOINT)
        self.public_client = Minio(
            settings.MINIO_PUBLIC_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_PUBLIC_SECURE,
            region="us-east-1",
        )
        print("Initialized public MinIO client with endpoint:", settings.MINIO_ENDPOINT)
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
        except S3Error as e:
            print(f"Error creating bucket: {e}")

    def upload_file(
        self, object_name: str, file_data: BinaryIO, length: int, content_type: str
    ) -> str:
        try:
            self.client.put_object(
                self.bucket_name,
                object_name,
                file_data,
                length,
                content_type=content_type,
            )
            return object_name
        except S3Error as e:
            raise Exception(f"Error uploading file: {e}")

    def get_file(self, object_name: str) -> BinaryIO:
        try:
            response = self.client.get_object(self.bucket_name, object_name)
            return response
        except S3Error as e:
            raise Exception(f"Error downloading file: {e}")

    def delete_file(self, object_name: str) -> bool:
        try:
            self.client.remove_object(self.bucket_name, object_name)
            return True
        except S3Error as e:
            raise Exception(f"Error deleting file: {e}")

    def get_presigned_url(self, object_name: str, expires: int = 3600) -> str:
        try:
            from datetime import timedelta

            url = self.public_client.presigned_get_object(
                self.bucket_name, object_name, expires=timedelta(seconds=expires)
            )

            return url
        except S3Error as e:
            raise Exception(f"Error generating presigned URL: {e}")


storage_service = StorageService()

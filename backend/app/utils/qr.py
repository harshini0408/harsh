import uuid


def generate_qr_token() -> str:
    """Generate a unique QR token (UUID4)."""
    return str(uuid.uuid4())


def generate_device_token() -> str:
    """Generate a unique device token (UUID4)."""
    return str(uuid.uuid4())

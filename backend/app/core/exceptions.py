from fastapi import HTTPException, status


class TableOccupiedError(HTTPException):
    """Raised when a table already has an active session."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Table already occupied."
        )


class InsufficientLoyaltyError(HTTPException):
    """Raised when a customer doesn't have enough loyalty credits."""
    def __init__(self, required: int, available: int):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient loyalty credits. Required: {required}, Available: {available}"
        )


class OrderNotDraftError(HTTPException):
    """Raised when trying to modify a non-draft order."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order can only be modified while in 'draft' status."
        )


class OrderNotSentError(HTTPException):
    """Raised when trying to pay for an order not yet sent to kitchen."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order must be sent to kitchen before payment."
        )


class GuestLoyaltyError(HTTPException):
    """Raised when a guest customer tries to use loyalty features."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loyalty features are only available for registered customers."
        )


class NotFoundError(HTTPException):
    """Generic not-found error."""
    def __init__(self, entity: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity} not found."
        )


class ForbiddenError(HTTPException):
    """Raised when user lacks required role."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action."
        )

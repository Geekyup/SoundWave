from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAuthorOrStaffOrReadOnly(BasePermission):
    """
    Allows write actions only to content author (by `author` field) or staff.
    Read actions are always allowed.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_staff:
            return True

        author = getattr(obj, 'author', '')
        if not isinstance(author, str):
            return False

        return author.strip().lower() == user.username.strip().lower()

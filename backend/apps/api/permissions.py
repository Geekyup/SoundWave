from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAuthorOrStaffOrReadOnly(BasePermission):
    """
    Allows write actions only to content author (by `author` field) or staff.
    Read actions are always allowed.
    """

    def has_object_permission(self, request, _view, instance):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_staff:
            return True

        author_name = getattr(instance, 'author', '')
        if not isinstance(author_name, str):
            return False

        return author_name.strip().lower() == user.username.strip().lower()

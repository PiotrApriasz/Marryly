namespace Marryly.Application.Models.GuestList;

public static class AttendanceStatus
{
    public const string Pending = "pending";
    public const string Confirmed = "confirmed";
    public const string Declined = "declined";

    public static bool IsSupported(string value) =>
        string.Equals(value, Pending, StringComparison.Ordinal) ||
        string.Equals(value, Confirmed, StringComparison.Ordinal) ||
        string.Equals(value, Declined, StringComparison.Ordinal);
}

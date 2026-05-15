namespace Marryly.Application.Models.GuestList;

public class GuestListSummary
{
    public int InvitedCount { get; set; }
    public int ConfirmedCount { get; set; }
    public double ConfirmationPercent { get; set; }
    public int AttendingTotalWithCouple { get; set; }
    public int VendorsCount { get; set; }
    public int AdultsCount { get; set; }
    public int Children3To10Count { get; set; }
    public int ChildrenUnder3Count { get; set; }
    public int AccommodationNeededCount { get; set; }
    public int TransportNeededCount { get; set; }
}

namespace Marryly.Application.Models.Media;

public class AddSelectedAlbumMediaRequest : DeleteSelectedAlbumMediaRequest
{
    public string? TargetAlbumId { get; set; }
}

using System.Diagnostics;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Microsoft.Extensions.Configuration;
using SixLabors.ImageSharp;

namespace Marryly.Infrastructure.Services;

public class VideoThumbnailService(
    IConfiguration configuration,
    IMediaStorageService mediaStorageService) : IVideoThumbnailService
{
    private const int DefaultMaxPixels = 1280;
    private const int DefaultSeekSeconds = 1;

    public async Task<VideoThumbnailResult> GenerateAsync(MediaItem mediaItem, CancellationToken ct = default)
    {
        if (!string.Equals(mediaItem.Kind, "video", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Video thumbnails can only be generated for video media.");
        }

        var tempDirectory = Path.Combine(Path.GetTempPath(), "marryly-video-thumbnails", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDirectory);
        var inputPath = Path.Combine(tempDirectory, "source-video");
        var outputPath = Path.Combine(tempDirectory, "thumbnail.jpg");

        try
        {
            await using (var source = await mediaStorageService.OpenOriginalReadAsync(mediaItem.OriginalBlobName, ct))
            await using (var destination = File.Create(inputPath))
            {
                await source.CopyToAsync(destination, ct);
            }

            await ExtractFrameAsync(inputPath, outputPath, ct);

            await using var thumbnailStream = File.OpenRead(outputPath);
            var imageInfo = await Image.IdentifyAsync(thumbnailStream, ct)
                ?? throw new InvalidOperationException("FFmpeg did not produce a readable thumbnail image.");
            thumbnailStream.Position = 0;

            var thumbnailBlobName = BuildThumbnailBlobName(mediaItem);
            await mediaStorageService.UploadDerivedAsync(thumbnailBlobName, thumbnailStream, "image/jpeg", ct);

            return new VideoThumbnailResult
            {
                ThumbnailBlobName = thumbnailBlobName,
                ThumbnailBlobUrl = mediaStorageService.GetDerivedBlobUrl(thumbnailBlobName),
                Width = imageInfo.Width,
                Height = imageInfo.Height,
                ProcessedAt = DateTime.UtcNow
            };
        }
        finally
        {
            Directory.Delete(tempDirectory, recursive: true);
        }
    }

    private async Task ExtractFrameAsync(string inputPath, string outputPath, CancellationToken ct)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = configuration["FFMPEG_PATH"]?.Trim() is { Length: > 0 } configuredPath ? configuredPath : "ffmpeg",
            UseShellExecute = false,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("-hide_banner");
        startInfo.ArgumentList.Add("-loglevel");
        startInfo.ArgumentList.Add("error");
        startInfo.ArgumentList.Add("-y");
        startInfo.ArgumentList.Add("-ss");
        startInfo.ArgumentList.Add(GetSeekSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("-i");
        startInfo.ArgumentList.Add(inputPath);
        startInfo.ArgumentList.Add("-frames:v");
        startInfo.ArgumentList.Add("1");
        startInfo.ArgumentList.Add("-vf");
        startInfo.ArgumentList.Add($"scale={GetMaxPixels()}:-2:force_original_aspect_ratio=decrease");
        startInfo.ArgumentList.Add("-q:v");
        startInfo.ArgumentList.Add("3");
        startInfo.ArgumentList.Add(outputPath);

        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Unable to start FFmpeg.");
        var errorOutputTask = process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        var errorOutput = await errorOutputTask;

        if (process.ExitCode != 0 || !File.Exists(outputPath) || new FileInfo(outputPath).Length == 0)
        {
            throw new InvalidOperationException($"FFmpeg could not extract a video thumbnail. {errorOutput}".Trim());
        }
    }

    private int GetMaxPixels()
    {
        return int.TryParse(configuration["VIDEO_THUMBNAIL_MAX_PIXELS"], out var value) && value is >= 320 and <= 3840
            ? value
            : DefaultMaxPixels;
    }

    private int GetSeekSeconds()
    {
        return int.TryParse(configuration["VIDEO_THUMBNAIL_SEEK_SECONDS"], out var value) && value is >= 0 and <= 30
            ? value
            : DefaultSeekSeconds;
    }

    private static string BuildThumbnailBlobName(MediaItem mediaItem)
    {
        var uploadDate = mediaItem.UploadedAt == default ? DateTime.UtcNow : mediaItem.UploadedAt;
        return $"events/{mediaItem.EventId}/videos/thumbnails/{uploadDate:yyyy}/{uploadDate:MM}/{uploadDate:dd}/{mediaItem.Id}.jpg";
    }
}

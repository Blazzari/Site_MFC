param(
  [string]$SourceRoot = "Photos",
  [string]$OutputRoot = "assets/photos",
  [int]$LargeMaxSize = 1800,
  [int]$ThumbMaxSize = 640,
  [int]$LargeQuality = 78,
  [int]$ThumbQuality = 72
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Convert-ToSlug {
  param([string]$Value)

  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object Text.StringBuilder

  foreach ($character in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($character)

    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($character)
    }
  }

  $slug = $builder.ToString().Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant()
  $slug = $slug -replace "[^a-z0-9]+", "-"
  $slug = $slug.Trim("-")

  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "photo"
  }

  return $slug
}

function Get-JpegCodec {
  [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1
}

function Save-ResizedJpeg {
  param(
    [string]$Source,
    [string]$Destination,
    [int]$MaxSize,
    [int]$Quality
  )

  $image = [System.Drawing.Image]::FromFile($Source)

  try {
    $ratio = [Math]::Min($MaxSize / $image.Width, $MaxSize / $image.Height)

    if ($ratio -gt 1) {
      $ratio = 1
    }

    $width = [Math]::Max(1, [int][Math]::Round($image.Width * $ratio))
    $height = [Math]::Max(1, [int][Math]::Round($image.Height * $ratio))
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)

    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }

      $directory = Split-Path -Path $Destination -Parent

      if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
      }

      $codec = Get-JpegCodec
      $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality,
        [long]$Quality
      )

      $bitmap.Save($Destination, $codec, $encoderParameters)
    } finally {
      $bitmap.Dispose()
    }

    return @{ Width = $width; Height = $height }
  } finally {
    $image.Dispose()
  }
}

if (-not (Test-Path $SourceRoot)) {
  throw "Le dossier source '$SourceRoot' est introuvable."
}

if (Test-Path $OutputRoot) {
  Remove-Item -Path $OutputRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputRoot | Out-Null

$categories = @(
  @{ Source = "Galerie stages passés"; Slug = "galerie-stages-passes" },
  @{ Source = "Vitrine conseil"; Slug = "vitrine-conseil" }
)

$manifest = New-Object System.Collections.Generic.List[object]
$allowedExtensions = @(".jpg", ".jpeg", ".png")

foreach ($category in $categories) {
  $categoryPath = Join-Path $SourceRoot $category.Source

  if (-not (Test-Path $categoryPath)) {
    continue
  }

  $files = Get-ChildItem -Path $categoryPath -Recurse -File |
    Where-Object { $allowedExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName

  foreach ($file in $files) {
    $relativeDirectory = Split-Path -Path $file.FullName.Substring($categoryPath.Length).TrimStart("\") -Parent
    $groupName = if ($relativeDirectory) { Split-Path -Path $relativeDirectory -Leaf } else { "Photos" }
    $groupSlug = Convert-ToSlug $groupName
    $baseSlug = Convert-ToSlug $file.BaseName
    $targetDirectory = Join-Path (Join-Path $OutputRoot $category.Slug) $groupSlug
    $thumbDirectory = Join-Path $targetDirectory "thumbs"
    $imagePath = Join-Path $targetDirectory "$baseSlug.jpg"
    $thumbPath = Join-Path $thumbDirectory "$baseSlug-thumb.jpg"

    $imageSize = Save-ResizedJpeg -Source $file.FullName -Destination $imagePath -MaxSize $LargeMaxSize -Quality $LargeQuality
    Save-ResizedJpeg -Source $file.FullName -Destination $thumbPath -MaxSize $ThumbMaxSize -Quality $ThumbQuality | Out-Null

    $manifest.Add([pscustomobject]@{
      category = $category.Slug
      group = $groupName
      groupSlug = $groupSlug
      source = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
      image = $imagePath.Replace("\", "/")
      thumb = $thumbPath.Replace("\", "/")
      originalBytes = $file.Length
      imageBytes = (Get-Item $imagePath).Length
      thumbBytes = (Get-Item $thumbPath).Length
      width = $imageSize.Width
      height = $imageSize.Height
    })
  }
}

$manifest |
  ConvertTo-Json -Depth 4 |
  Set-Content -Path (Join-Path $OutputRoot "photos-manifest.json") -Encoding UTF8

$manifest |
  Group-Object category, groupSlug |
  ForEach-Object {
    $first = $_.Group | Select-Object -First 1
    [pscustomobject]@{
      category = $first.category
      group = $first.group
      groupSlug = $first.groupSlug
      count = $_.Count
      cover = $first.thumb
    }
  } |
  ConvertTo-Json -Depth 4 |
  Set-Content -Path (Join-Path $OutputRoot "photos-albums.json") -Encoding UTF8

Write-Host "Photos préparees : $($manifest.Count)"
Write-Host "Manifest : $(Join-Path $OutputRoot 'photos-manifest.json')"

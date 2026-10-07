$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$publicRoot = Join-Path $projectRoot 'public'
$imagesRoot = Join-Path $publicRoot 'images'
$splashRoot = Join-Path $imagesRoot 'splash'
New-Item -ItemType Directory -Force -Path $splashRoot | Out-Null
$source = [System.Drawing.Bitmap]::new((Join-Path $imagesRoot 'ubs.png'))

# Crop only the transparent margins of the existing brand asset.
$left = $source.Width; $top = $source.Height; $right = 0; $bottom = 0
for ($y = 0; $y -lt $source.Height; $y++) {
  for ($x = 0; $x -lt $source.Width; $x++) {
    if ($source.GetPixel($x, $y).A -gt 20) {
      $left = [Math]::Min($left, $x); $top = [Math]::Min($top, $y)
      $right = [Math]::Max($right, $x); $bottom = [Math]::Max($bottom, $y)
    }
  }
}
$sourceRect = [System.Drawing.Rectangle]::new($left, $top, $right - $left + 1, $bottom - $top + 1)
$ratio = $sourceRect.Height / $sourceRect.Width
function Write-BrandImage([string]$name, [int]$width, [int]$height, [int]$logoWidth) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $logoHeight = [int][Math]::Round($logoWidth * $ratio)
    $target = [System.Drawing.Rectangle]::new([int](($width - $logoWidth) / 2), [int](($height - $logoHeight) / 2), $logoWidth, $logoHeight)
    $graphics.DrawImage($source, $target, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $bitmap.Save((Join-Path $imagesRoot $name), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

# A centered 72% wordmark fits entirely inside the maskable 40%-radius safe circle.
Write-BrandImage 'icon-192-v3.png' 192 192 138
Write-BrandImage 'icon-512-v3.png' 512 512 369
Write-BrandImage 'icon-maskable-192-v3.png' 192 192 138
Write-BrandImage 'icon-maskable-512-v3.png' 512 512 369
Write-BrandImage 'apple-touch-icon-v3.png' 180 180 130
Write-BrandImage 'favicon-v3.png' 32 32 28
Write-BrandImage 'logo-wordmark.png' 1060 ([int][Math]::Round(1060 * $ratio)) 1060

# iOS launch images must match screen dimensions and orientation exactly.
$screens = @(
  @(320,568,2), @(375,667,2), @(414,736,3), @(375,812,3), @(414,896,2),
  @(414,896,3), @(390,844,3), @(428,926,3), @(393,852,3), @(430,932,3),
  @(402,874,3), @(440,956,3), @(360,780,3), @(768,1024,2), @(810,1080,2),
  @(820,1180,2), @(834,1112,2), @(834,1194,2), @(1024,1366,2)
)
$links = [System.Collections.Generic.List[string]]::new()
foreach ($screen in $screens) {
  $w = $screen[0]; $h = $screen[1]; $dpr = $screen[2]
  foreach ($orientation in @('portrait','landscape')) {
    $pixelWidth = $w * $dpr; $pixelHeight = $h * $dpr
    if ($orientation -eq 'landscape') { $pixelWidth = $h * $dpr; $pixelHeight = $w * $dpr }
    $fileName = "$pixelWidth`x$pixelHeight-v3.png"
    Write-BrandImage "splash/$fileName" $pixelWidth $pixelHeight (240 * $dpr)
    $links.Add("    <link rel=`"apple-touch-startup-image`" href=`"/images/splash/$fileName`" media=`"(device-width: $($w)px) and (device-height: $($h)px) and (-webkit-device-pixel-ratio: $dpr) and (orientation: $orientation)`" />")
  }
}
$source.Dispose()
$htmlPath = Join-Path $projectRoot 'index.html'
$html = [System.IO.File]::ReadAllText($htmlPath)
$html = [regex]::Replace($html, '(?s)    <!-- iOS launch images -->.*?    <!-- End iOS launch images -->', ('    <!-- iOS launch images -->' + "`n" + ($links -join "`n") + "`n    <!-- End iOS launch images -->"))
[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Generated square icons, wordmark and 38 iOS launch images.'

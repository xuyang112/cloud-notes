Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$directory = Join-Path $root 'public/images'
[System.IO.Directory]::CreateDirectory($directory) | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 1200, 280
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f7f9fc'))
$font = New-Object System.Drawing.Font 'Consolas', 23
$smallFont = New-Object System.Drawing.Font 'Segoe UI', 14
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#3f5066'))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#8c99aa'))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$border = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#dce4ee')), 2
$blue = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#7296c7')), 2
$blue.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
foreach ($item in @(@(40, 'HelloNote.java', 'SOURCE'), @(448, 'HelloNote.class', 'BYTECODE'), @(895, 'JVM', 'RUNTIME'))) {
  $x = [int]$item[0]
  $width = if ($x -eq 895) { 255 } else { 280 }
  $graphics.FillRectangle($white, $x, 105, $width, 82)
  $graphics.DrawRectangle($border, $x, 105, $width, 82)
  $rect = New-Object System.Drawing.RectangleF $x, 105, $width, 82
  $graphics.DrawString([string]$item[1], $font, $ink, $rect, $format)
  $label = New-Object System.Drawing.RectangleF $x, 53, $width, 32
  $graphics.DrawString([string]$item[2], $smallFont, $muted, $label, $format)
}
$graphics.DrawLine($blue, 335, 146, 430, 146)
$graphics.DrawLine($blue, 744, 146, 874, 146)
$graphics.DrawString('javac', $smallFont, $muted, 350, 167)
$graphics.DrawString('java', $smallFont, $muted, 785, 167)
$graphics.DrawString('01', $smallFont, $muted, 166, 210)
$graphics.DrawString('02', $smallFont, $muted, 574, 210)
$graphics.DrawString('03', $smallFont, $muted, 1012, 210)
$bitmap.Save((Join-Path $directory 'java-workflow.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
$smallFont.Dispose()
$ink.Dispose()
$muted.Dispose()
$white.Dispose()
$border.Dispose()
$blue.Dispose()
$format.Dispose()

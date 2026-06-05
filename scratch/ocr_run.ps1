$ErrorActionPreference = "Stop"

# Load Windows Runtime types and register namespaces
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]

# Find the generic AsTask method for IAsyncOperation`1
$asTaskIAsyncOperation = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and 
    $_.GetParameters().Count -eq 1 -and 
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

function Await-IAsyncOperation {
    param(
        $WinRtOperation,
        [Type]$ResultType
    )
    $asTask = $asTaskIAsyncOperation.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtOperation))
    return $netTask.GetAwaiter().GetResult()
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    Write-Error "Windows OCR Engine could not be initialized."
    Exit 1
}

$outPath = "c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\scratch\ocr_result.txt"
Set-Content -Path $outPath -Value "=== OCR START ===" -Encoding UTF8

for ($i = 0; $i -le 10; $i++) {
    $imgFile = "c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\scratch\page_$i.png"
    if (Test-Path $imgFile) {
        Write-Host "Running OCR on page $i..."
        
        # 1. Open file using .NET File stream synchronously
        $netStream = [System.IO.File]::OpenRead($imgFile)
        
        # 2. Convert to WinRT IRandomAccessStream synchronously
        $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($netStream)

        # 3. Decode the image asynchronously
        $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
        $decoder = Await-IAsyncOperation $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])

        # 4. Get the software bitmap asynchronously
        $bitmapTask = $decoder.GetSoftwareBitmapAsync()
        $bitmap = Await-IAsyncOperation $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])

        # 5. Run the OCR engine asynchronously
        $ocrTask = $engine.RecognizeAsync($bitmap)
        $result = Await-IAsyncOperation $ocrTask ([Windows.Media.Ocr.OcrResult])

        Add-Content -Path $outPath -Value "`r`n=== PAGE $i ===`r`n" -Encoding UTF8
        Add-Content -Path $outPath -Value $result.Text -Encoding UTF8
        
        # Close the streams to free up memory
        $stream.Dispose()
        $netStream.Dispose()
    }
}
Write-Host "OCR Completed successfully!"

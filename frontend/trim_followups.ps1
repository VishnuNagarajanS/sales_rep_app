$fp = 'D:\sales_repo\sales_rep_app\frontend\src\pages\Followups\FollowupsPage.tsx'
$lines = [System.IO.File]::ReadAllLines($fp)
$trimmed = $lines[0..373]
[System.IO.File]::WriteAllLines($fp, $trimmed)
Write-Host "Done. Lines now: $($trimmed.Length)"

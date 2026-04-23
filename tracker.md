Yes. Now that `track.invoicecreation.store` is live, Phase 1 is simple:

* put one small script on each laptop
* give each laptop a unique device name
* schedule it to run every 15 minutes

Below is a clean template you can reuse on all laptops.

# Recommended naming format

Use a fixed pattern like:

```text
INTERN-01
INTERN-02
INTERN-03
...
INTERN-15
```

That keeps your dashboard neat.

---

# Windows laptop file template

Create a folder on each laptop:

```text
C:\Tracker
```

Inside it, create a file named:

```text
track.bat
```

Paste this:

```bat
@echo off
set DEVICE=INTERN-01
set TRACK_URL=https://track.invoicecreation.store/track.php

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%TRACK_URL%?device=%DEVICE%').Content } catch { $_.Exception.Message }"
```

## What to change on each laptop

Only change this line:

```bat
set DEVICE=INTERN-01
```

Examples:

* laptop 1 → `INTERN-01`
* laptop 2 → `INTERN-02`
* laptop 3 → `INTERN-03`

Everything else stays the same.

---

# Better version with local log file

This helps you confirm the task is running.

Use this instead if you want logging:

```bat
@echo off
set DEVICE=INTERN-01
set TRACK_URL=https://track.invoicecreation.store/track.php
set LOGFILE=C:\Tracker\tracker_log.txt

echo [%date% %time%] START %DEVICE% >> %LOGFILE%
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%TRACK_URL%?device=%DEVICE%').Content } catch { $_.Exception.Message }" >> %LOGFILE% 2>&1
echo [%date% %time%] END %DEVICE% >> %LOGFILE%
echo. >> %LOGFILE%
```

## Files on each laptop

Your folder should look like:

```text
C:\Tracker\track.bat
C:\Tracker\tracker_log.txt
```

The log file will appear after first run.

---

# How to test manually on each laptop

On the laptop:

1. Open `C:\Tracker`
2. Double-click `track.bat`

Then check your dashboard:

```text
https://track.invoicecreation.store/dashboard.php
```

You should see that device appear or refresh.

You can also check the laptop-side log:

```text
C:\Tracker\tracker_log.txt
```

---

# Task Scheduler setup guide

## Step 1: Open Task Scheduler

Press Start and search:

```text
Task Scheduler
```

Open it.

---

## Step 2: Create the task

Click:

```text
Create Task
```

Do not use “Basic Task”.

---

## Step 3: General tab

Set:

* **Name:** `Laptop Tracker`
* check **Run whether user is logged on or not**
* check **Run with highest privileges**

---

## Step 4: Triggers tab

Click **New**

Set:

* Begin the task: `At log on`

Then check:

* **Repeat task every:** `15 minutes`
* **For a duration of:** `Indefinitely`

Make sure **Enabled** is checked.

Click OK.

---

## Step 5: Actions tab

Click **New**

Set:

**Program/script**

```text
cmd.exe
```

**Add arguments**

```text
/c C:\Tracker\track.bat
```

**Start in**

```text
C:\Tracker
```

Click OK.

---

## Step 6: Conditions tab

Untick these if checked:

* Start the task only if the computer is on AC power
* Stop if the computer switches to battery power
* Start only if the following network connection is available

---

## Step 7: Settings tab

Tick:

* Allow task to be run on demand
* Run task as soon as possible after a scheduled start is missed

For:

* If the task is already running → choose `Do not start a new instance`

Click OK.

If Windows asks for password, enter the laptop login password.

---

# How to verify scheduler is working

## Method 1: Run from Task Scheduler

* right-click `Laptop Tracker`
* click `Run`

Then check:

* dashboard
* or `C:\Tracker\tracker_log.txt`

---

## Method 2: Check result code

In Task Scheduler, look for:

* **Last Run Result = `0x0`**

That means success.

---

## Method 3: Command line check

Open Command Prompt:

```cmd
schtasks /query /tn "Laptop Tracker" /fo LIST /v
```

Look at:

* Last Run Time
* Last Result

---

# Quick deployment checklist for each laptop

1. Create `C:\Tracker`
2. Paste `track.bat`
3. Change only `DEVICE=...`
4. Double-click once to test
5. Confirm on dashboard
6. Create scheduled task
7. Run task manually once
8. Confirm again on dashboard

---

# Master device list suggestion

Keep a sheet like this:

| Laptop   | Device Tag | Assigned To |
| -------- | ---------- | ----------- |
| Laptop 1 | INTERN-01  | Rahul       |
| Laptop 2 | INTERN-02  | Priya       |
| Laptop 3 | INTERN-03  | Aman        |

That helps you know which laptop is which on the dashboard.

---

# Final recommended script template

Use this one:

```bat
@echo off
set DEVICE=INTERN-01
set TRACK_URL=https://track.invoicecreation.store/track.php
set LOGFILE=C:\Tracker\tracker_log.txt

echo [%date% %time%] START %DEVICE% >> %LOGFILE%
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%TRACK_URL%?device=%DEVICE%').Content } catch { $_.Exception.Message }" >> %LOGFILE% 2>&1
echo [%date% %time%] END %DEVICE% >> %LOGFILE%
echo. >> %LOGFILE%
```

Change only:

```bat
set DEVICE=INTERN-01
```

---

Phase 2 can be:

* better dashboard UI
* last seen status colors
* exact map link
* Wi-Fi/network fingerprinting for better location precision

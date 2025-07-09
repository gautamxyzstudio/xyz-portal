# Automated Attendance Management System

This system automatically manages employee attendance using cron jobs to eliminate manual entry requirements.

## 🚀 Features

### Automated Daily Operations
- **6:00 AM Daily**: Creates attendance entries for all active users
- **10:00 PM Daily**: Marks users as absent if they didn't check in
- **7:00 AM Monday**: Generates weekly attendance reports

### Manual Triggers (for testing)
- `POST /daily-attendance/cron/trigger-daily` - Manually trigger daily entry creation
- `POST /daily-attendance/cron/trigger-end-of-day` - Manually trigger end-of-day processing

## 📊 New Attendance Status System

The attendance system now includes status tracking:
- **`present`** - User checked in successfully
- **`absent`** - User didn't check in (default for auto-generated entries)
- **`late`** - User checked in late
- **`half-day`** - User worked half day
- **`leave`** - User was on leave

## 👥 Role-Based Attendance Tracking

### Included Roles
- **Employee** - Full attendance tracking
- **Manager** - Full attendance tracking
- **Seo** - Full attendance tracking

### Excluded Roles
- **Admin** - No attendance tracking (exempt from daily entries and check-ins)
- **Hr** - No attendance tracking (exempt from daily entries and check-ins)

*Note: Admin and Hr users cannot manually check in and will receive an error message if they attempt to do so.*

## 🔧 How It Works

### 1. Daily Entry Creation (6:00 AM)
- Automatically creates attendance entries for all active users (excluding Admin and Hr roles)
- Sets default status as `absent`
- Adds note: "Auto-generated entry - awaiting check-in"

### 2. User Check-in Process
- When user checks in, status changes to `present`
- Updates notes to "User checked in successfully"
- If no entry exists, creates one automatically

### 3. End of Day Processing (10:00 PM)
- Finds all entries still marked as `absent`
- Confirms absence status
- Updates notes to indicate end-of-day processing

## 📈 New API Endpoints

### Cron Job Endpoints
```
POST /daily-attendance/cron/create-daily-entries
POST /daily-attendance/cron/mark-absent-users
GET /daily-attendance/stats?startDate=2024-01-01&endDate=2024-01-31
```

### Manual Trigger Endpoints
```
POST /daily-attendance/cron/trigger-daily
POST /daily-attendance/cron/trigger-end-of-day
```

## 🛠️ Configuration

### Timezone
The cron jobs are configured for **Asia/Kolkata** timezone. To change:
1. Edit `src/bootstrap.ts`
2. Update the timezone in the cron job configurations

### Schedule Customization
To modify the schedule, edit the cron expressions in `src/bootstrap.ts`:

```javascript
// Current schedules:
'0 6 * * *'   // 6:00 AM daily
'0 22 * * *'  // 10:00 PM daily  
'0 7 * * 1'   // 7:00 AM every Monday
```

## 📋 Usage Examples

### Test the System
```bash
# Manually trigger daily entry creation
curl -X POST http://localhost:1337/api/daily-attendance/cron/trigger-daily

# Manually trigger end-of-day processing
curl -X POST http://localhost:1337/api/daily-attendance/cron/trigger-end-of-day

# Get attendance statistics
curl "http://localhost:1337/api/daily-attendance/stats?startDate=2024-01-01&endDate=2024-01-31"
```

### Check-in Process
```bash
# User checks in
curl -X POST http://localhost:1337/api/daily-attendance/check-in \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "user": 1,
      "date": "2024-01-15",
      "in": "09:00:00"
    }
  }'
```

## 🔍 Monitoring

The system logs all cron job activities:
- ✅ Success messages with statistics
- ❌ Error messages with details
- 📊 Processing results and counts

Check your Strapi console for real-time logs when cron jobs run.

## 🚨 Important Notes

1. **User Filtering**: Only active (non-blocked, confirmed) users with roles other than Admin and Hr get attendance entries
2. **Role Restrictions**: Admin and Hr users are excluded from attendance tracking
3. **Duplicate Prevention**: System checks for existing entries before creating new ones
4. **Error Handling**: Failed operations are logged but don't stop the process
5. **Timezone**: Ensure your server timezone matches the configured timezone

## 🔄 Migration

If you have existing attendance data:
1. The new `status` and `notes` fields will be added automatically
2. Existing entries will have `status: null` until updated
3. New entries will use the default `absent` status

## 🆘 Troubleshooting

### Cron Jobs Not Running
1. Check if Strapi is running continuously
2. Verify timezone settings
3. Check console logs for initialization messages

### Manual Triggers Not Working
1. Ensure the API endpoints are accessible
2. Check authentication if required
3. Verify the service methods exist

### TypeScript Errors
1. Run `npm run build` to regenerate types
2. Check for syntax errors in service files
3. Ensure all imports are correct 
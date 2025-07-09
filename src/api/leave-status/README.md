# Leave Status API

This API provides endpoints for managing leave requests, including the ability to approve and reject leave applications.

## Available Routes

### Default CRUD Routes
- `GET /api/leave-statuses` - Get all leave statuses
- `GET /api/leave-statuses/:id` - Get a specific leave status
- `POST /api/leave-statuses` - Create a new leave status
- `PUT /api/leave-statuses/:id` - Update a leave status
- `DELETE /api/leave-statuses/:id` - Delete a leave status

### Custom Routes

#### Approve Leave Request
- **Method**: `POST`
- **Path**: `/api/leave-status/:id/approve`
- **Authentication**: Not required (can be added if needed)
- **Description**: Approves a leave request by setting its status to "approved"

**Example Request:**
```bash
curl -X POST \
  http://localhost:1337/api/leave-status/1/approve
```

**Response:**
```json
{
  "message": "Leave request approved successfully",
  "data": {
    "id": 1,
    "title": "Vacation Leave",
    "status": "approved",
    "start_date": "2024-01-15",
    "end_date": "2024-01-20",
    // ... other fields
  }
}
```

#### Reject Leave Request
- **Method**: `POST`
- **Path**: `/api/leave-status/:id/reject`
- **Authentication**: Not required (can be added if needed)
- **Description**: Rejects a leave request by setting its status to "declined" and requires a decline reason

**Request Body:**
```json
{
  "decline_reason": "Insufficient notice period"
}
```

**Example Request:**
```bash
curl -X POST \
  http://localhost:1337/api/leave-status/1/reject \
  -H 'Content-Type: application/json' \
  -d '{
    "decline_reason": "Insufficient notice period"
  }'
```

**Response:**
```json
{
  "message": "Leave request rejected successfully",
  "data": {
    "id": 1,
    "title": "Vacation Leave",
    "status": "declined",
    "decline_reason": "Insufficient notice period",
    "start_date": "2024-01-15",
    "end_date": "2024-01-20",
    // ... other fields
  }
}
```

## Error Responses

### Leave Request Not Found
```json
{
  "error": {
    "status": 404,
    "name": "Not Found",
    "message": "Leave request not found"
  }
}
```

### Missing Decline Reason
```json
{
  "error": {
    "status": 400,
    "name": "Bad Request",
    "message": "Decline reason is required"
  }
}
```

## Status Values

The leave status can have the following values:
- `pending` - Leave request is awaiting approval
- `approved` - Leave request has been approved
- `declined` - Leave request has been rejected

## Notes

- The routes use POST method for both approve and reject actions
- The reject route requires a `decline_reason` in the request body
- The routes will automatically update the `status` field and, for rejections, the `decline_reason` field
- All responses include the updated leave request data
- Authentication policies can be added to the routes if needed for security 
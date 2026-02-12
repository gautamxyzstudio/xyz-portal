/* ===================== TIME HELPERS ===================== */

const ABSENT_CUTOFF_HOUR = 10;

const getISTNow = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

const getISTDate = () => {
  const d = getISTNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* SESSION */
const getSession = (now) => {
  const t = now.getHours() + now.getMinutes() / 60;
  if (t >= 9 && t < 13) return "FIRST";
  if (t >= 13 && t < 14) return "FIRST_BREAK";
  if (t >= 14 && t < 18) return "SECOND";
  return "OFF";
};

/* Deadline */
const getDeadline = (leaveRecord) => {
  if (!leaveRecord) return ABSENT_CUTOFF_HOUR;

  // first half leave → must report after lunch
  if (
    leaveRecord.leave_category === "half_day" &&
    leaveRecord.half_day_type === "first_half"
  ) return 14;

  // second half leave → must report morning
  if (
    leaveRecord.leave_category === "half_day" &&
    leaveRecord.half_day_type === "second_half"
  ) return 10;

  // short leave → must report when leave ends
  if (leaveRecord.leave_category === "short_leave" && leaveRecord.start_time) {
    const [h, m] = leaveRecord.start_time.split(":");
    return Number(h) + Number(m) / 60;
  }

  return ABSENT_CUTOFF_HOUR;
};

export default {
  async stats(ctx) {
    try {
      const now = getISTNow();
      const today = getISTDate();
      const session = getSession(now);
      const currentTime = now.getHours() + now.getMinutes() / 60;

      let present = 0;
      let leave = 0;
      let pending = 0;
      let absent = 0;

      /* EMPLOYEES */
      const employees = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          where: { blocked: false, user_type: "Employee" },
          select: ["id"],
        });

      /* ATTENDANCE (use createdAt as real checkin) */
      const attendance = await strapi.db
        .query("api::daily-attendance.daily-attendance")
        .findMany({
          where: { Date: today },
          populate: ["user"],
        });

      const checkinMap = {};
      attendance.forEach((a) => {
        if (a.user?.id && a.createdAt) {
          const istDate = new Date(
            new Date(a.createdAt).toLocaleString("en-US", {
              timeZone: "Asia/Kolkata",
            })
          );
          checkinMap[a.user.id] =
            istDate.getHours() + istDate.getMinutes() / 60;
        }
      });

      /* LEAVES (DATE FIX — VERY IMPORTANT) */
      const leaves = await strapi.db
        .query("api::leave-status.leave-status")
        .findMany({
          where: {
            status: "approved",
            start_date: { $lte: today },
            end_date: { $gte: today },
          },
          populate: ["user"],
        });

      const leaveMap = {};
      leaves.forEach((l) => {
        if (l.user?.id) leaveMap[l.user.id] = l;
      });

      /* WORKFORCE ENGINE */
      for (const emp of employees) {
        const id = emp.id;
        const leaveRecord = leaveMap[id];
        const checkinTime = checkinMap[id];
        const checkedIn = checkinTime !== undefined;

        /* FULL DAY */
        if (leaveRecord?.leave_category === "full_day") {
          leave++;
          continue;
        }

        /* SECOND HALF LEAVE */
        if (
          leaveRecord?.leave_category === "half_day" &&
          leaveRecord?.half_day_type === "second_half"
        ) {
          if (session === "SECOND") {
            leave++;
            continue;
          }
        }

        /* FIRST HALF LEAVE */
        if (
          leaveRecord?.leave_category === "half_day" &&
          leaveRecord?.half_day_type === "first_half"
        ) {
          if ((session === "FIRST" || session === "FIRST_BREAK") && !checkedIn) {
            leave++;
            continue;
          }
        }

        /* SHORT LEAVE WINDOW */
        if (leaveRecord?.leave_category === "short_leave") {
          if (leaveRecord.start_time) {
            const [sh, sm] = leaveRecord.start_time.split(":");
            const start = Number(sh) + Number(sm) / 60;

            if (!checkedIn && currentTime < start) {
              leave++;
              continue;
            }
          }
        }

        /* PRESENT */
        if (checkedIn && checkinTime <= currentTime) {
          present++;
          continue;
        }

        /* BREAK FREEZE */
        if (session === "FIRST_BREAK") {
          pending++;
          continue;
        }

        /* ABSENT/PENDING */
        const deadline = getDeadline(leaveRecord);

        if (currentTime < deadline) pending++;
        else absent++;
      }

      ctx.body = {
        session,
        date: today,
        time: now.toLocaleTimeString("en-IN"),
        officeHours: "9:00 AM – 6:00 PM",
        totalEmployees: employees.length,
        presentEmployees: present,
        employeesOnLeave: leave,
        absentEmployees: absent,
        pendingEmployees: pending,
      };

    } catch (error) {
      strapi.log.error("Dashboard Stats Error", error);
      ctx.throw(500, "Unable to fetch dashboard stats");
    }
  },
};

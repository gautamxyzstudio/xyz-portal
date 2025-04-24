export default {
  async findAll(ctx) {
    const { page = 1, pageSize = 10 } = ctx.query;

    const attendance = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        start: (page - 1) * pageSize,
        limit: pageSize,
        populate: {
          user: {
            populate: {
              user_detial: {
                populate: {
                  Photo: true,
                },
              },
            },
          },
        },
      }
    );

    const total = await strapi.entityService.count(
      'api::daily-attendance.daily-attendance'
    );

    ctx.body = {
      data: attendance,
      meta: {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
    };

    return ctx.body;
  },
  async find(ctx) {
    const { id } = ctx.params;
    const attendance = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          user: id,
        },
      }
    );
    ctx.body = attendance;
    return attendance;
  },
  async findToday(ctx) {
    const { id } = ctx.params;
    const attendance = await strapi.entityService.findMany(
      'api::daily-attendance.daily-attendance',
      {
        filters: {
          Date: new Date().toISOString().split('T')[0],
          user: id,
        },
      }
    );
    ctx.body = attendance;
    return attendance;
  },
  async checkIn(ctx) {
    const { user, date, in: inTime } = ctx.request.body.data;
    console.log('Incoming data request:', ctx.request.body);

    const attendance = await strapi.entityService.create(
      'api::daily-attendance.daily-attendance',
      {
        data: {
          user: user,
          Date: date,
          in: inTime,
        },
      }
    );
    console.log('Attendance Response:', attendance);

    ctx.body = attendance;
    return attendance;
  },
  async checkOut(ctx) {
    const { id, out } = ctx.request.body.data;

    if (!id || !out) {
      return ctx.badRequest('Missing required fields: user or out');
    }

    const attendance = await strapi.entityService.update(
      'api::daily-attendance.daily-attendance',
      id,
      {
        data: { out },
      }
    );

    ctx.body = attendance;
    return attendance;
  },
};

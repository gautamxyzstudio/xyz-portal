import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::add-blog.add-blog",
  ({ strapi }) => ({
    async findBySlug(ctx) {
      try {
        const { slug } = ctx.params;

        if (!slug) {
          return ctx.badRequest("Slug is required");
        }

        const blog = await strapi.db.query("api::add-blog.add-blog").findOne({
          where: {
            blogSlug: {
              $eq: slug,
            },
            publishedAt: {
              $notNull: true,
            },
          },
          populate: {
            banner: true,
          },
        });

        if (!blog) {
          return ctx.notFound("Blog not found");
        }

        return ctx.send(blog);
      } catch (error) {
        console.error("❌ FIND BLOG BY SLUG ERROR:", error);
        return ctx.internalServerError("Something went wrong");
      }
    },
  }),
);

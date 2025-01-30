/**
 * add-blog controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::add-blog.add-blog", ({ strapi }) => ({
  async create(ctx) {
    try {
      const response = await super.create(ctx);
      return response;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async delete(ctx) {
    try {
      const response = await super.delete(ctx);
      return response;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async find(ctx) {
    try {
      const response = await super.find(ctx);
      return response;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async findOne(ctx) {
    try {
      const response = await super.findOne(ctx);
      return response;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async update(ctx) {
    try {
      const response = await super.update(ctx);
      return response;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  /**
   * Find a blog by title
   */
  async findByTitle(ctx) {
    try {
      const { title } = ctx.params;
      if (!title) {
        return ctx.badRequest("Title is required");
      }

      const blog = await strapi.db.query("api::add-blog.add-blog").findOne({
        where: { title },
        populate: { banner: true }, // Populate banner image

      });

      if (!blog) {
        return ctx.notFound("Blog not found");
      }

      return blog;
    } catch (error) {
      ctx.throw(500, error);
    }
  },
}));

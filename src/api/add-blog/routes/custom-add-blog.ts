export default {
  routes: [
    {
      method: "GET",
      path: "/find-blog-by-slug/:slug",
      handler: "custom-blog.findBySlug",
      config: {
        auth: false,
      },
    },
  ],
};

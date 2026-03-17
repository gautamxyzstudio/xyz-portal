export default (plugin: any) => {
  const originalCallback = plugin.controllers.auth.callback;

  plugin.controllers.auth.callback = async (ctx: any) => {
    try {
      return await originalCallback(ctx);
    } catch (error: any) {
      
      // ✅ Blocked user error
      if (
        error?.message ===
        "Your account has been blocked by an administrator"
      ) {
        return ctx.forbidden(error.message);
      }

      // ✅ Invalid credentials
      if (error?.message === "Invalid identifier or password") {
        return ctx.badRequest(error.message);
      }

      // ✅ fallback
      return ctx.badRequest(error?.message || "Login failed");
    }
  };

  return plugin;
};
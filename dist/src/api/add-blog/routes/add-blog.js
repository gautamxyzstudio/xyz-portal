module.exports = {
    routes: [
        {
            method: "GET",
            path: "/add-blogs",
            handler: "add-blog.find",
        },
        {
            method: "GET",
            path: "/add-blogs/:id",
            handler: "add-blog.findOne",
        },
        {
            method: "POST",
            path: "/add-blogs",
            handler: "add-blog.create",
        },
        {
            method: "PUT",
            path: "/add-blogs/:id",
            handler: "add-blog.update",
        },
        {
            method: "DELETE",
            path: "/add-blogs/:id",
            handler: "add-blog.delete",
        },
        {
            method: "GET",
            path: "/add-blogs/title/:title",
            handler: "add-blog.findByTitle",
        },
    ],
};

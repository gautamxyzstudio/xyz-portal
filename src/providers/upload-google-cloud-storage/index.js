// // "use strict";

// // const { Storage } = require("@google-cloud/storage");
// // const path = require("path");
// // const { Readable } = require("stream");

// // module.exports = {
// //   init(providerOptions) {
// //     const storage = new Storage({
// //       projectId: providerOptions.projectId,
// //       keyFilename: providerOptions.keyFilename,
// //     });

// //     const bucket = storage.bucket(providerOptions.bucket);

// //     const uploadToGCS = (file, stream) =>
// //       new Promise((resolve, reject) => {
// //         const fileName = `uploads/${file.hash}${file.ext}`;
// //         const blob = bucket.file(fileName);

// //         const blobStream = blob.createWriteStream({
// //           resumable: false,
// //           metadata: { contentType: file.mime },
// //         });

// //         blobStream.on("error", reject);

// //         blobStream.on("finish", () => {
// //           const publicUrl = `https://storage.googleapis.com/${providerOptions.bucket}/${fileName}`;

// //           file.url = publicUrl;
// //           file.previewUrl = publicUrl;
// //           file.provider = "google-cloud-storage";
// //           file.isImage = true;
// //           file.width = file.width || 1;
// //           file.height = file.height || 1;

// //           file.formats = {
// //             thumbnail: {
// //               name: file.name,
// //               hash: file.hash,
// //               ext: file.ext,
// //               mime: file.mime,
// //               size: file.size,
// //               width: file.width,
// //               height: file.height,
// //               url: publicUrl,
// //             },
// //           };

// //           resolve();
// //         });

// //         stream.pipe(blobStream);
// //       });

// //     return {
// //       async uploadStream(file) {
// //         return uploadToGCS(file, file.stream);
// //       },

// //       async upload(file) {
// //         return uploadToGCS(file, Readable.from(file.buffer));
// //       },

// //       async delete(file) {
// //         const fileName = path.basename(file.url);
// //         await bucket.file(`uploads/${fileName}`).delete().catch(() => {});
// //       },
// //     };
// //   },
// // };

// "use strict";

// const { Storage } = require("@google-cloud/storage");
// const path = require("path");
// const { Readable } = require("stream");

// module.exports = {
//   init(providerOptions) {
//     const storage = new Storage({
//       projectId: providerOptions.projectId,
//       keyFilename: providerOptions.keyFilename,
//     });

//     const bucket = storage.bucket(providerOptions.bucket);

//     const uploadToGCS = (file, stream) =>
//       new Promise((resolve, reject) => {
//         const fileName = `uploads/${file.hash}${file.ext}`;
//         const blob = bucket.file(fileName);

//         const blobStream = blob.createWriteStream({
//           resumable: false,
//           metadata: { contentType: file.mime },
//         });

//         blobStream.on("error", reject);

//         blobStream.on("finish", () => {
//           const publicUrl = `https://storage.googleapis.com/${providerOptions.bucket}/${fileName}`;

//           // ✅ Required for Strapi v4
//           file.url = publicUrl;
//           file.provider = "google-cloud-storage";

//           // ✅ Required for Media Library thumbnails
//           file.isImage = file.mime.startsWith("image/");
//           file.width = file.width || 1;
//           file.height = file.height || 1;

//           // ✅ Minimal format to keep v4 happy
//           file.formats = file.isImage
//             ? {
//                 thumbnail: {
//                   name: file.name,
//                   hash: file.hash,
//                   ext: file.ext,
//                   mime: file.mime,
//                   size: file.size,
//                   width: file.width,
//                   height: file.height,
//                   url: publicUrl,
//                 },
//               }
//             : null;

//           // ✅ Media Library folder
//           file.folderPath = "/google-cloud";

//           // Optional but good practice
//           file.provider_metadata = {
//             bucket: providerOptions.bucket,
//             path: fileName,
//           };

//           resolve();
//         });

//         stream.pipe(blobStream);
//       });

//     return {
//       uploadStream(file) {
//         return uploadToGCS(file, file.stream);
//       },

//       upload(file) {
//         return uploadToGCS(file, Readable.from(file.buffer));
//       },

//       async delete(file) {
//         if (!file?.url) return;
//         const fileName = path.basename(file.url);
//         await bucket.file(`uploads/${fileName}`).delete().catch(() => {});
//       },
//     };
//   },
// };


"use strict";

const { Storage } = require("@google-cloud/storage");
const path = require("path");
const { Readable } = require("stream");

module.exports = {
  init(providerOptions) {
    const storage = new Storage({
      projectId: providerOptions.projectId,
      keyFilename: providerOptions.keyFilename,
    });

    const bucket = storage.bucket(providerOptions.bucket);

    const uploadToGCS = (file, stream) =>
      new Promise((resolve, reject) => {
        const fileName = `uploads/${file.hash}${file.ext}`;
        const blob = bucket.file(fileName);

        const blobStream = blob.createWriteStream({
          resumable: false,
          metadata: { contentType: file.mime },
        });

        blobStream.on("error", reject);

        blobStream.on("finish", () => {
          const publicUrl = `https://storage.googleapis.com/${providerOptions.bucket}/${fileName}`;

          // ✅ Required for Strapi v4
          file.url = publicUrl;
          file.provider = "google-cloud-storage";

          // ✅ Image metadata (v4 needs this)
          file.isImage = file.mime.startsWith("image/");
          file.width = file.width || 1;
          file.height = file.height || 1;

          // ✅ Minimal formats for v4
          file.formats = file.isImage
            ? {
                thumbnail: {
                  name: file.name,
                  hash: file.hash,
                  ext: file.ext,
                  mime: file.mime,
                  size: file.size,
                  width: file.width,
                  height: file.height,
                  url: publicUrl,
                },
              }
            : null;

          // 🔥 CRITICAL FOR STRAPI v4 MEDIA LIBRARY
          file.folder = 2;        // google-cloud folder ID
          file.folderPath = "/2"; // numeric path REQUIRED

          // Optional metadata
          file.provider_metadata = {
            bucket: providerOptions.bucket,
            path: fileName,
          };

          resolve();
        });

        stream.pipe(blobStream);
      });

    return {
      uploadStream(file) {
        return uploadToGCS(file, file.stream);
      },

      upload(file) {
        return uploadToGCS(file, Readable.from(file.buffer));
      },

      async delete(file) {
        if (!file?.url) return;
        const fileName = path.basename(file.url);
        await bucket.file(`uploads/${fileName}`).delete().catch(() => {});
      },
    };
  },
};

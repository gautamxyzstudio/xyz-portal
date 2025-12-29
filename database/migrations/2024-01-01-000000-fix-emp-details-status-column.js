// 'use strict';

// /**
//  * This migration fixes the emp_details status column by:
//  * 1. Converting existing string values to boolean
//  * 2. Altering the column type to boolean
//  */

// async function up(knex) {
//   // First, update existing data to convert string values to boolean
//   await knex.raw(`
//     UPDATE emp_details 
//     SET status = CASE 
//       WHEN status = 'active' OR status = 'true' OR status = '1' THEN true
//       WHEN status = 'inactive' OR status = 'false' OR status = '0' THEN false
//       ELSE true
//     END
//   `);

//   // Then alter the column type to boolean
//   await knex.raw(`
//     ALTER TABLE emp_details 
//     ALTER COLUMN status TYPE boolean USING status::boolean
//   `);
// }

// async function down(knex) {
//   // Revert the column back to string type
//   await knex.raw(`
//     ALTER TABLE emp_details 
//     ALTER COLUMN status TYPE varchar(255)
//   `);
// }

// module.exports = { up, down }; 


'use strict';

/**
 * Fix emp_details.status column
 * - Convert string values to boolean
 * - Change column type to boolean
 * - Safe for fresh/local DBs
 */

module.exports = {
  async up(knex) {
    const tableName = 'api_emp_details_emp_details';

    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      console.log(
        `Skipping migration: ${tableName} table does not exist yet`
      );
      return;
    }

    // 1️⃣ Normalize existing values
    await knex.raw(`
      UPDATE ${tableName}
      SET status = CASE
        WHEN status IN ('active', 'true', '1') THEN true
        WHEN status IN ('inactive', 'false', '0') THEN false
        ELSE true
      END
    `);

    // 2️⃣ Change column type to boolean
    await knex.raw(`
      ALTER TABLE ${tableName}
      ALTER COLUMN status TYPE boolean
      USING status::boolean
    `);
  },

  async down(knex) {
    const tableName = 'api_emp_details_emp_details';

    const exists = await knex.schema.hasTable(tableName);
    if (!exists) return;

    await knex.raw(`
      ALTER TABLE ${tableName}
      ALTER COLUMN status TYPE varchar(255)
    `);
  },
};

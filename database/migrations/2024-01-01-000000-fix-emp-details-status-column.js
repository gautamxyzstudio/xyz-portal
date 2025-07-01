'use strict';

/**
 * This migration fixes the emp_details status column by:
 * 1. Converting existing string values to boolean
 * 2. Altering the column type to boolean
 */

async function up(knex) {
  // First, update existing data to convert string values to boolean
  await knex.raw(`
    UPDATE emp_details 
    SET status = CASE 
      WHEN status = 'active' OR status = 'true' OR status = '1' THEN true
      WHEN status = 'inactive' OR status = 'false' OR status = '0' THEN false
      ELSE true
    END
  `);

  // Then alter the column type to boolean
  await knex.raw(`
    ALTER TABLE emp_details 
    ALTER COLUMN status TYPE boolean USING status::boolean
  `);
}

async function down(knex) {
  // Revert the column back to string type
  await knex.raw(`
    ALTER TABLE emp_details 
    ALTER COLUMN status TYPE varchar(255)
  `);
}

module.exports = { up, down }; 
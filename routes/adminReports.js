// Admin Reports API Routes
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ensure this points to your DB connection

// Create the necessary database fields if they don't exist
async function ensureReportTableFields() {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Check if status field exists
    const [statusColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_reports' 
      AND COLUMN_NAME = 'status'
    `);
    
    if (statusColumns.length === 0) {
      // Add status field
      await connection.query(`
        ALTER TABLE user_reports 
        ADD COLUMN status VARCHAR(20) DEFAULT 'new'
      `);
      console.log('Added status column to user_reports table');
    }
    
    // Check if admin_notes field exists
    const [notesColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_reports' 
      AND COLUMN_NAME = 'admin_notes'
    `);
    
    if (notesColumns.length === 0) {
      // Add admin_notes field
      await connection.query(`
        ALTER TABLE user_reports 
        ADD COLUMN admin_notes TEXT
      `);
      console.log('Added admin_notes column to user_reports table');
    }
    
    // Check if admin_id field exists
    const [adminIdColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_reports' 
      AND COLUMN_NAME = 'admin_id'
    `);
    
    if (adminIdColumns.length === 0) {
      // Add admin_id field
      await connection.query(`
        ALTER TABLE user_reports 
        ADD COLUMN admin_id VARCHAR(255)
      `);
      console.log('Added admin_id column to user_reports table');
    }
    
    // Check if status_updated_at field exists
    const [statusTimeColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_reports' 
      AND COLUMN_NAME = 'status_updated_at'
    `);
    
    if (statusTimeColumns.length === 0) {
      // Add status_updated_at field
      await connection.query(`
        ALTER TABLE user_reports 
        ADD COLUMN status_updated_at TIMESTAMP
      `);
      console.log('Added status_updated_at column to user_reports table');
    }
    
  } catch (error) {
    console.error('Error ensuring user_reports table structure:', error);
  } finally {
    if (connection) connection.release();
  }
}

// Run the table structure check at startup
ensureReportTableFields();

// // Middleware to ensure admin access
// const ensureAdmin = (req, res, next) => {
//   // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
//   //   return res.status(403).json({ error: 'Unauthorized access' });
//   // }
//   next();
// };

// // Apply admin middleware to all routes
// router.use(ensureAdmin);

// Get all reports
router.get('/reports', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Fetch all reports
    const [reports] = await connection.query(`
      SELECT * FROM user_reports
      ORDER BY created_at DESC
    `);
    
    res.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Get a specific report by ID
router.get('/reports/:reportId', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { reportId } = req.params;
    
    // Fetch specific report
    const [reports] = await connection.query(`
      SELECT * FROM user_reports
      WHERE id = ?
    `, [reportId]);
    
    if (reports.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ report: reports[0] });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Update report status
router.put('/reports/:reportId/status', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { reportId } = req.params;
    const { status, notes } = req.body;
    
    // Validate status
    const validStatuses = ['new', 'in-progress', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
  

    const [result] = await db.query(
      'UPDATE user_reports SET status = ?, admin_notes = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes, reportId]
    );

  
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Get updated report
    const [updatedReports] = await connection.query(`
      SELECT * FROM user_reports
      WHERE id = ?
    `, [reportId]);
    
    res.json({ 
      success: true, 
      message: 'Report status updated successfully',
      report: updatedReports[0]
    });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Get reports statistics
router.get('/reports/stats', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Get count of reports by status
    const [results] = await connection.query(`
      SELECT 
        COALESCE(status, 'new') as status, 
        COUNT(*) as count 
      FROM user_reports 
      GROUP BY COALESCE(status, 'new')
    `);
    
    // Transform results into an object
    const stats = {
      total: 0,
      new: 0,
      'in-progress': 0,
      resolved: 0,
      dismissed: 0
    };
    
    results.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching report statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Delete a report (for admin cleanup purposes)
router.delete('/reports/:reportId', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { reportId } = req.params;
    
    // Delete the report
    const [result] = await connection.query(`
      DELETE FROM user_reports
      WHERE id = ?
    `, [reportId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
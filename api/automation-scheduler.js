/**
 * Automation Scheduler
 * Cron jobs for automated tasks
 *
 * Tasks:
 * - Daily: Check payment reminders, deadline reminders
 * - Weekly: Send judge progress reports
 * - On-demand: Winner announcements, certificate generation
 */

const cron = require('node-cron');
const { sendDeadlineReminders, sendWinnerAnnouncements } = require('./email-automation');
const { assignJudgesToEntries, generateAllShortlists } = require('./judge-automation');
const { generateAllWinnerCertificates } = require('./certificates-qr');

/**
 * Daily automation tasks (runs at 9:00 AM)
 */
cron.schedule('0 9 * * *', async () => {
  console.log('\n⏰ Running daily automation tasks...');

  try {
    // Send deadline reminders
    await sendDeadlineReminders();

    // Check for pending payments (older than 7 days)
    // TODO: Implement payment reminder logic

    console.log('✅ Daily automation complete\n');
  } catch (error) {
    console.error('❌ Error in daily automation:', error);
  }
}, {
  timezone: 'Europe/London'
});

/**
 * Weekly automation tasks (runs Monday at 8:00 AM)
 */
cron.schedule('0 8 * * 1', async () => {
  console.log('\n📊 Running weekly automation tasks...');

  try {
    // Send judge progress reports
    // TODO: Implement judge progress reports

    // Generate statistics report
    // TODO: Implement statistics reporting

    console.log('✅ Weekly automation complete\n');
  } catch (error) {
    console.error('❌ Error in weekly automation:', error);
  }
}, {
  timezone: 'Europe/London'
});

/**
 * Judging deadline check (runs daily at 10:00 AM during judging period)
 */
cron.schedule('0 10 * * *', async () => {
  console.log('\n⚖️ Checking judging progress...');

  try {
    // Check if judging deadline is approaching
    const judgingDeadline = new Date('2025-02-15'); // TODO: Get from database
    const now = new Date();
    const daysUntilDeadline = Math.ceil((judgingDeadline - now) / (1000 * 60 * 60 * 24));

    if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
      console.log(`📅 Judging deadline in ${daysUntilDeadline} days`);
      // Send reminders handled by sendDeadlineReminders()
    }

    if (daysUntilDeadline === 0) {
      console.log('🎯 Judging deadline reached - generating shortlists');
      await generateAllShortlists();
    }

    console.log('✅ Judging check complete\n');
  } catch (error) {
    console.error('❌ Error in judging check:', error);
  }
}, {
  timezone: 'Europe/London'
});

/**
 * Manual trigger functions (called via API)
 */

async function triggerWinnerAnnouncements() {
  console.log('🏆 Triggering winner announcements...');

  try {
    // Send email announcements
    const emailCount = await sendWinnerAnnouncements();

    // Generate certificates
    const certResults = await generateAllWinnerCertificates();

    // Post to social media
    // TODO: Integrate with social-media.js

    console.log(`✅ Announced ${emailCount} winners`);
    console.log(`✅ Generated ${certResults.filter(r => r.success).length} certificates`);

    return {
      success: true,
      emailsSent: emailCount,
      certificatesGenerated: certResults.filter(r => r.success).length
    };

  } catch (error) {
    console.error('❌ Error in winner announcements:', error);
    throw error;
  }
}

async function triggerJudgeAssignments(awardId = null) {
  console.log('👨‍⚖️ Triggering judge assignments...');

  try {
    const result = await assignJudgesToEntries(awardId);

    console.log(`✅ Assigned ${result.assigned} judges to entries`);

    return result;

  } catch (error) {
    console.error('❌ Error in judge assignments:', error);
    throw error;
  }
}

async function triggerShortlistGeneration(awardId = null) {
  console.log('🌟 Triggering shortlist generation...');

  try {
    let results;

    if (awardId) {
      const { generateShortlist } = require('./judge-automation');
      const shortlist = await generateShortlist(awardId);
      results = [{ awardId, shortlistCount: shortlist.length }];
    } else {
      results = await generateAllShortlists();
    }

    // Send shortlist notifications
    const { sendShortlistNotifications } = require('./email-automation');
    await sendShortlistNotifications(awardId);

    console.log('✅ Shortlists generated and notifications sent');

    return results;

  } catch (error) {
    console.error('❌ Error in shortlist generation:', error);
    throw error;
  }
}

/**
 * API Endpoints
 */

function setupAutomationEndpoints(app) {
  // POST /api/automation/trigger-winner-announcements
  app.post('/api/automation/trigger-winner-announcements', async (req, res) => {
    try {
      const result = await triggerWinnerAnnouncements();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/automation/trigger-judge-assignments
  app.post('/api/automation/trigger-judge-assignments', async (req, res) => {
    try {
      const { awardId } = req.body;
      const result = await triggerJudgeAssignments(awardId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/automation/trigger-shortlist-generation
  app.post('/api/automation/trigger-shortlist-generation', async (req, res) => {
    try {
      const { awardId } = req.body;
      const results = await triggerShortlistGeneration(awardId);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Automation endpoints registered');
}

/**
 * Start scheduler
 */
function startScheduler() {
  console.log('🚀 Automation scheduler started');
  console.log('📅 Daily tasks: 9:00 AM GMT');
  console.log('📅 Weekly tasks: Monday 8:00 AM GMT');
  console.log('📅 Judging checks: 10:00 AM GMT');
}

module.exports = {
  startScheduler,
  setupAutomationEndpoints,
  triggerWinnerAnnouncements,
  triggerJudgeAssignments,
  triggerShortlistGeneration
};

// Start scheduler if running directly
if (require.main === module) {
  startScheduler();
  console.log('\n✅ Scheduler is running. Press Ctrl+C to stop.\n');
}

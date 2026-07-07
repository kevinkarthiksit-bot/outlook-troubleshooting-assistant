/**
 * SharePoint configuration for Outlook Troubleshooting Assistant.
 * Update these values when deploying to your SharePoint site.
 */
const SP_CONFIG = {
  useSharePoint: false,
  siteUrl: "",
  kbFilePath: "/sites/ITSupport/Shared Documents/OutlookAssistant/kb-articles.json",
  kbUploadFolder: "/sites/ITSupport/Shared Documents/OutlookAssistant",
  logListTitle: "OutlookAssistantLogs",
  localKbPath: "data/kb-articles.sample.json",
  localTroubleshootingPath: "data/troubleshooting-guide.json",
  kbCacheHours: 24,
  adminGroups: ["Outlook Assistant Admins", "Site Owners"],
  employeeIdSource: "loginName",
  promptForEmployeeId: false,
  logRetentionDays: 90,
  escalationUrl: "mailto:itsupport@company.com?subject=Outlook%20Issue%20Escalation",
  adminUsername: "Hannah",
  adminPassword: "Hannah@95"
};

if (typeof window !== "undefined") {
  window.SP_CONFIG = SP_CONFIG;
}

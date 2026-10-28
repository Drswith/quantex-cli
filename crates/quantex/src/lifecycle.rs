//! Install, update, and uninstall: observe, decide, execute, verify, record.

use crate::catalog::Agent;
use crate::context::Context;

/// Why installing an agent before launch did not succeed.
#[derive(Debug, Clone)]
pub enum LaunchInstallFailure {
    TimedOut,
    Failed(String),
}

/// Installs a missing agent so it can be launched.
pub fn install_for_launch(_ctx: &Context, agent: &Agent) -> Result<(), LaunchInstallFailure> {
    Err(LaunchInstallFailure::Failed(format!(
        "installing {} is not implemented in this build yet",
        agent.name
    )))
}

//! `--help`, `-h`, and `help [command]` print usage on stdout and exit 0, as in v1.13.6.
//! Running quantex without arguments prints usage on stderr and exits 1. The help text
//! itself is not contract.

use quantex_contract_tests::Sandbox;

#[test]
fn help_requests_print_usage_and_succeed() {
    let sandbox = Sandbox::new();
    let cases: [(&[&str], &str); 7] = [
        (&["--help"], "quantex"),
        (&["-h"], "quantex"),
        (&["help"], "quantex"),
        (&["help", "install"], "quantex install"),
        (&["install", "--help"], "quantex install"),
        (&["list", "-h"], "quantex list"),
        (&["exec", "--help"], "quantex exec"),
    ];
    for (args, usage) in cases {
        let run = sandbox.run(args);
        assert_eq!(run.code, 0, "{args:?}: {run:?}");
        assert!(run.stdout.contains(&format!("Usage: {usage}")), "{args:?}: {run:?}");
        assert_eq!(run.stderr, "", "{args:?}: {run:?}");
    }
}

#[test]
fn no_arguments_prints_usage_and_fails() {
    let run = Sandbox::new().run::<[&str; 0], &str>([]);
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(run.stdout, "");
    assert!(run.stderr.contains("Usage: quantex"), "{run:?}");
}

<script>
    import Button from "../components/Button.svelte";
    import { ranPage, ranSelection } from "../store";

    export let type;
    // button on click events
    function onRun() {
        if(type == 'page') {
            console.log("set")
            ranPage.set(true)
        } else if (type == 'selection') {
            console.log("set")
            ranSelection.set(true)
        }
    }
</script>

<div class="container">
    <div class='body'>
        <div class='text-xl-med'>
            TDS Linter 2.0
        </div>
        <div class='text-md-reg'>
            Once you press "Run Lint", the linter will analyze your files using predefined rules from the Trulioo design system and display any design issues on the screen!
        </div>
    </div>
    <div class="footer">
        <div class="footer2">
            <Button type={"primary"} onClick={onRun}>Run</Button>
        </div>
    </div>
</div>

<style>
    .container {
        justify-content: flex-start;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .body {
        flex-grow: 1;
        display:flex;
        flex-direction: column;
        gap:8px;
        justify-content: center;
        padding: 32px;
    }

    .footer {
        border-top: 1px solid #d5d5d5;
        width: 100%;
        display: flex;
        flex-direction: row;
        background-color: white;
    }

    .footer2 {
        display: flex;
        padding: 16px 24px;
        gap: 8px;
        flex-grow:1;
    }

    .flex {
        flex-grow: 1;
    }
</style>

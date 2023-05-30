<script>
    import Button from "../components/Button.svelte";
    import { focus } from "../store";

    let focusLayer;
    focus.subscribe((value) => {
        focusLayer = value;
        console.log(focusLayer)
    });

    window.addEventListener("message", handleMessage);

    function handleMessage(event) {
        const message = event.data;
        if (message && message.pluginMessage.currentSelection) {
            focus.set(message.pluginMessage.currentSelection);
        }
    }

    function darkChange() {
        parent.postMessage({ pluginMessage: { type: "dark" } }, "*");
    }

    function lightChange() {
        parent.postMessage({ pluginMessage: { type: "light" } }, "*");
    }
</script>

<div class="container">
    <div class="selection-box">
        {#if focusLayer.length > 0}
            <div class="text-xl-med">{focusLayer}</div>
        {:else}
            <div class="text-xl-med">Select a Frame</div>
        {/if}
        <div class="text-md-reg">
            Selected frames will be able to be changed for light and dark.
        </div>
    </div>
    <div class="flex-horizontal">
        <Button onClick={lightChange}>Light Theme</Button>
        <Button onClick={darkChange}>Dark Theme</Button>
    </div>
</div>

<style>
    .container {
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        gap: 24px;
    }

    .selection-box {
        padding: 24px;
        border: 1px dashed #d2d2d2;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 8px;
        align-self: stretch;
        flex-grow: 1;
    }

    .flex-horizontal {
        display: flex;
        justify-content: space-between;
        gap: 16px;
    }
</style>

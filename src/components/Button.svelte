<script>
    export let onClick;
    export let type;
</script>

<button class={type == 'primary' ? "button-secondary" : ""} on:click={onClick}>
    <slot></slot>
</button>

<style>
    .button-secondary {
        border: 1px solid #808080;
        border-radius: 8px;
        padding: 8px 16px;
        background-color: #ffffff;
        color: #121212;
    }

    .button-secondary:hover {
        background-color: #E5F0E8;
        animation-name: on-hover-button;
        animation-duration: 100ms;
        cursor: pointer;
    }

    @keyframes on-hover-button {
        0% {
            background-color: #ffffff;
        }
        100% {
            background-color: #E5F0E8;
        }
    }

    .button-tertiary {
        border-radius: 8px;
        color: #242426;
        cursor: pointer;
    }

    .button-tertiary-on {
        border-radius: 8px;
        color: #169794;
        cursor: pointer;
    }

    .button-tertiary:hover {
        color: #169794;
    }
</style>

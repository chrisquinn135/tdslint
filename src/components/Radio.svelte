<script>
    export let checked;
</script>

<div class="radio-button {checked ? 'checked' : ''}" />

<style>
    .radio-button {
        margin-right: 8px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px #808080;
        background-color: #ffffff;
    }

    .radio-button.checked {
        box-shadow: inset 0 0 0 5px #004c45;
    }
</style>

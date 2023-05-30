<script>
	import Tabbar from "./components/Tabbar.svelte";
	import Lint from "./pages/Lint.svelte";

	function createShapes() {
		parent.postMessage(
			{
				pluginMessage: {
					type: "create-shapes",
					count: count,
					shape: selectedShape.value,
				},
			},
			"*"
		);
	}

	function cancel() {
		parent.postMessage({ pluginMessage: { type: "cancel" } }, "*");
	}
</script>

<div class="">
	<Tabbar />
	<Lint />
</div>

<style global>
	@import url("https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap");

	/* Body Structures */
	:global(body) {
		font: 12px "Libre Franklin", "cursive";
		font-family: "Libre Franklin", "cursive";
		text-align: center;
		margin: 0;
		background-color: white;
	}

	/* Text */
	:global(.text-sm-reg) {
		font: 12px "Libre Franklin";
		font-weight: 400;
	}

	:global(.text-sm-med) {
		font: 12px "Libre Franklin";
		font-weight: 500;
	}

	:global(.text-md-reg) {
		font: 14px "Libre Franklin";
		font-weight: 400;
	}

	:global(.text-md-med) {
		font: 14px "Libre Franklin";
		font-weight: 500;
	}

	:global(.text-lg-med) {
		font: 16px "Libre Franklin";
		font-weight: 500;
	}

	:global(.text-lg-semibold) {
		font: 16px "Libre Franklin";
		font-weight: 600;
	}

	:global(.text-xl-semibold) {
		font: 18px "Libre Franklin";
		font-weight: 600;
	}
	/* Add additional global or scoped styles here */
</style>

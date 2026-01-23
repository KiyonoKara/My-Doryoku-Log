<!-- src/lib/CsvExportButton.svelte -->
<script lang="ts">
	import { type Transaction } from '$lib/server/db/schema';

	export let label: string = 'Export CSV';
	export let description: string = 'Download transactions as CSV file';
	export let iconPath: string = '/src/lib/assets/file-report.svg';
	export let transactions: Transaction[] = [];
	export let filename: string = 'transactions.csv';
	export let ariaLabel: string = 'Export to CSV';

	function handleExport() {
		if (transactions.length === 0) {
			alert('No transactions to export');
			return;
		}
	}
</script>
<script lang="ts">
	const getContrastColor = (hexColor: string) => {
		// Remove the hash if present
		const color = hexColor.replace('#', '');
		// Convert to RGB
		const r = parseInt(color.substring(0, 2), 16);
		const g = parseInt(color.substring(2, 4), 16);
		const b = parseInt(color.substring(4, 6), 16);
		// Calculate the luminance
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		// Return black for light colors, white for dark colors
		return luminance > 0.5 ? '#000000' : '#FFFFFF';
	};
	import Card from '$lib/components/bootstrap/Card.svelte';
	import { confirm, notify } from '$lib/utils/prompts.svelte';

	const { data } = $props();
	const tagStruct = $derived(data.finance.structs.tags);
	const tags = $derived(data.finance.queries.tags.reactive);

	let name = $state('');
	let color = $state('#0d6efd');
	let editId = $state<string | null>(null);
	let editName = $state('');
	let editColor = $state('#0d6efd');
	let colorUpdatingId = $state<string | null>(null);

	const createTag = async () => {
		if (!name.trim()) {
			notify({
				title: 'Validation',
				message: 'Tag name is required',
				color: 'warning',
				autoHide: 2500
			});
			return;
		}
		const result = await tagStruct.new({
			name: name.trim(),
			color
		});
		if (result.isErr()) {
			notify({
				title: 'Failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		name = '';
		notify({
			title: 'Created',
			message: 'Tag created',
			color: 'success',
			autoHide: 2000
		});
	};

	const startEdit = (
		id: string | undefined,
		currentName: string | undefined,
		currentColor: string | undefined
	) => {
		if (!id) return;
		editId = id;
		editName = currentName ?? '';
		editColor = currentColor ?? '#0d6efd';
	};

	const saveEdit = async () => {
		if (!editId) return;
		const row = tags.find((tag) => tag.id === editId);
		if (!row) return;
		const result = await row.update({
			name: editName.trim(),
			color: editColor
		});
		if (result.isErr()) {
			notify({
				title: 'Save failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		editId = null;
		notify({
			title: 'Saved',
			message: 'Tag updated',
			color: 'success',
			autoHide: 2000
		});
	};

	const updateTagColor = async (id: string | undefined, nextColor: string) => {
		if (!id || colorUpdatingId) return;
		const row = tags.find((tag) => tag.id === id);
		if (!row) return;
		colorUpdatingId = id;
		const result = await row.update({
			color: nextColor
		});
		colorUpdatingId = null;
		if (result.isErr()) {
			notify({
				title: 'Color update failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		notify({
			title: 'Color saved',
			message: 'Tag color updated',
			color: 'success',
			autoHide: 1800
		});
	};

	const archiveTag = async (id: string | undefined, tagName: string | undefined) => {
		if (!id) return;
		const ok = await confirm(`Archive tag "${tagName}"?`);
		if (!ok) return;
		const row = tags.find((tag) => tag.id === id);
		if (!row) return;
		const result = await row.update({ archived: true } as never);
		if (result.isErr()) {
			notify({
				title: 'Archive failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 5000
			});
			return;
		}
		notify({
			title: 'Archived',
			message: tagName ?? 'Tag',
			color: 'success',
			autoHide: 2500
		});
	};
</script>

<div class="container-fluid py-3">
	<div class="row g-3">
		<div class="col-12 col-lg-4">
			<Card title="Create tag">
				{#snippet body()}
					<div class="vstack gap-2">
						<input class="form-control" placeholder="Tag name" bind:value={name} />
						<input class="form-control form-control-color" type="color" bind:value={color} />
						<button class="btn btn-primary" type="button" onclick={createTag}>Create tag</button>
					</div>
				{/snippet}
			</Card>
		</div>

		<div class="col-12 col-lg-8">
			<Card title="Tags">
				{#snippet body()}
					{#if !tags.length}
						<div class="alert alert-secondary mb-0">No tags found.</div>
					{:else}
						<div class="table-responsive">
							<table class="table table-sm align-middle mb-0">
								<thead>
									<tr>
										<th>Name</th>
										<th>Color</th>
										<th class="text-end">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each tags as tag (tag.id)}
										<tr>
											<td>
												{#if editId === tag.id}
													<input class="form-control form-control-sm" bind:value={editName} />
												{:else}
													{tag.raw.name}
												{/if}
											</td>
											<td>
												{#if editId === tag.id}
													<input
														class="form-control form-control-color"
														type="color"
														bind:value={editColor}
													/>
												{:else}
													<div class="d-flex gap-2 align-items-center justify-content-between">
														<span class="badge rounded-pill" style="
															background: {tag.raw.color};
															color: {getContrastColor(tag.raw.color)};
														">
															{tag.raw.color}
														</span>
														<input
															class="form-control form-control-color"
															type="color"
															value={tag.raw.color}
															disabled={colorUpdatingId === tag.id}
															aria-label="Edit color for {tag.raw.name}"
															onchange={(event) => {
																const target = event.currentTarget as HTMLInputElement;
																void updateTagColor(tag.id, target.value);
															}}
														/>
													</div>
												{/if}
											</td>
											<td class="text-end">
												{#if editId === tag.id}
													<div class="btn-group btn-group-sm">
														<button class="btn btn-success" type="button" onclick={saveEdit}
															>Save</button
														>
														<button
															class="btn btn-outline-secondary"
															type="button"
															onclick={() => (editId = null)}
														>
															Cancel
														</button>
													</div>
												{:else}
													<div class="btn-group btn-group-sm">
														<button
															class="btn btn-outline-secondary"
															type="button"
															onclick={() => startEdit(tag.id, tag.raw.name, tag.raw.color)}
														>
															Edit
														</button>
														<button
															class="btn btn-outline-danger"
															type="button"
															onclick={() => archiveTag(tag.id, tag.raw.name)}
														>
															Archive
														</button>
													</div>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/snippet}
			</Card>
		</div>
	</div>
</div>

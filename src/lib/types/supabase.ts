export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	budgeting: {
		Tables: {
			asset: {
				Row: {
					archived: boolean;
					created_at: string;
					current_value: number;
					id: string;
					name: string;
				};
				ComputedFields: never;
				Insert: {
					archived: boolean;
					created_at?: string;
					current_value: number;
					id?: string;
					name: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					current_value?: number;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
			bucket: {
				Row: {
					archived: boolean;
					balance: number;
					created_at: string;
					id: string;
					name: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					balance: number;
					created_at?: string;
					id?: string;
					name: string;
				};
				Update: {
					archived?: boolean;
					balance?: number;
					created_at?: string;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
			budget: {
				Row: {
					archived: boolean;
					created_at: string;
					end_date: string;
					id: string;
					name: string;
					start_date: string;
					status: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					end_date: string;
					id?: string;
					name: string;
					start_date: string;
					status: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					end_date?: string;
					id?: string;
					name?: string;
					start_date?: string;
					status?: string;
				};
				Relationships: [];
			};
			budget_item: {
				Row: {
					archived: boolean;
					budget_id: string;
					category: string;
					created_at: string;
					id: string;
					planned_amount: number;
					rollover: boolean;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					budget_id: string;
					category: string;
					created_at?: string;
					id?: string;
					planned_amount: number;
					rollover: boolean;
				};
				Update: {
					archived?: boolean;
					budget_id?: string;
					category?: string;
					created_at?: string;
					id?: string;
					planned_amount?: number;
					rollover?: boolean;
				};
				Relationships: [
					{
						foreignKeyName: 'budget_item_budget_id_fkey';
						columns: ['budget_id'];
						isOneToOne: false;
						referencedRelation: 'budget';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'budget_item_category_fkey';
						columns: ['category'];
						isOneToOne: false;
						referencedRelation: 'category';
						referencedColumns: ['id'];
					}
				];
			};
			category: {
				Row: {
					archived: boolean;
					color: string | null;
					created_at: string;
					icon: string | null;
					id: string;
					kind: string;
					name: string;
					parent_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					color?: string | null;
					created_at?: string;
					icon?: string | null;
					id?: string;
					kind: string;
					name: string;
					parent_id?: string | null;
				};
				Update: {
					archived?: boolean;
					color?: string | null;
					created_at?: string;
					icon?: string | null;
					id?: string;
					kind?: string;
					name?: string;
					parent_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'category_parent_id_fkey';
						columns: ['parent_id'];
						isOneToOne: false;
						referencedRelation: 'category';
						referencedColumns: ['id'];
					}
				];
			};
			tags: {
				Row: {
					archived: boolean;
					color: string;
					created_at: string;
					id: string;
					name: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					color: string;
					created_at?: string;
					id?: string;
					name: string;
				};
				Update: {
					archived?: boolean;
					color?: string;
					created_at?: string;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
			transaction: {
				Row: {
					amount: number;
					archived: boolean;
					bucket_id: string;
					category: string | null;
					created_at: string;
					description: string | null;
					id: string;
					transfer_sibling: string | null;
				};
				ComputedFields: never;
				Insert: {
					amount: number;
					archived?: boolean;
					bucket_id: string;
					category?: string | null;
					created_at?: string;
					description?: string | null;
					id?: string;
					transfer_sibling?: string | null;
				};
				Update: {
					amount?: number;
					archived?: boolean;
					bucket_id?: string;
					category?: string | null;
					created_at?: string;
					description?: string | null;
					id?: string;
					transfer_sibling?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'transaction_bucket_id_fkey';
						columns: ['bucket_id'];
						isOneToOne: false;
						referencedRelation: 'bucket';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'transaction_category_fkey';
						columns: ['category'];
						isOneToOne: false;
						referencedRelation: 'category';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'transaction_transfer_sibling_fkey';
						columns: ['transfer_sibling'];
						isOneToOne: false;
						referencedRelation: 'transaction';
						referencedColumns: ['id'];
					}
				];
			};
			transaction_tag: {
				Row: {
					archived: boolean;
					created_at: string;
					id: string;
					tag_id: string | null;
					transaction_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					archived: boolean;
					created_at?: string;
					id?: string;
					tag_id?: string | null;
					transaction_id?: string | null;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: string;
					tag_id?: string | null;
					transaction_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'transaction_tag_tag_id_fkey';
						columns: ['tag_id'];
						isOneToOne: false;
						referencedRelation: 'tags';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'transaction_tag_transaction_id_fkey';
						columns: ['transaction_id'];
						isOneToOne: false;
						referencedRelation: 'transaction';
						referencedColumns: ['id'];
					}
				];
			};
			transaction_transfer_dismissal: {
				Row: {
					archived: boolean;
					created_at: string;
					id: string;
					left_transaction_id: string;
					right_transaction_id: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					id?: string;
					left_transaction_id: string;
					right_transaction_id: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: string;
					left_transaction_id?: string;
					right_transaction_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'transaction_transfer_dismissal_left_transaction_id_fkey';
						columns: ['left_transaction_id'];
						isOneToOne: false;
						referencedRelation: 'transaction';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'transaction_transfer_dismissal_right_transaction_id_fkey';
						columns: ['right_transaction_id'];
						isOneToOne: false;
						referencedRelation: 'transaction';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	core: {
		Tables: {
			account_notification: {
				Row: {
					account_id: string;
					archived: boolean;
					created_at: string;
					icon: string;
					icon_type: string;
					id: string;
					link: string | null;
					message: string;
					read: boolean;
					severity: string;
					title: string;
				};
				ComputedFields: never;
				Insert: {
					account_id: string;
					archived?: boolean;
					created_at?: string;
					icon: string;
					icon_type: string;
					id?: string;
					link?: string | null;
					message: string;
					read?: boolean;
					severity: string;
					title: string;
				};
				Update: {
					account_id?: string;
					archived?: boolean;
					created_at?: string;
					icon?: string;
					icon_type?: string;
					id?: string;
					link?: string | null;
					message?: string;
					read?: boolean;
					severity?: string;
					title?: string;
				};
				Relationships: [];
			};
			admin: {
				Row: {
					archived: boolean;
					created_at: string;
					id: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					id?: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: string;
				};
				Relationships: [];
			};
			cached_request: {
				Row: {
					archived: boolean;
					created_at: string;
					headers: string;
					id: string;
					response: string;
					status: number;
					ttl: number;
					url: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					headers: string;
					id?: string;
					response: string;
					status: number;
					ttl: number;
					url: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					headers?: string;
					id?: string;
					response?: string;
					status?: number;
					ttl?: number;
					url?: string;
				};
				Relationships: [];
			};
			profile: {
				Row: {
					archived: boolean;
					created_at: string;
					email: string;
					first_name: string;
					id: string;
					last_name: string;
					username: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					email: string;
					first_name: string;
					id: string;
					last_name: string;
					username: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					email?: string;
					first_name?: string;
					id?: string;
					last_name?: string;
					username?: string;
				};
				Relationships: [];
			};
			role: {
				Row: {
					archived: boolean;
					color: string;
					created_at: string;
					description: string;
					id: string;
					name: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					color: string;
					created_at?: string;
					description: string;
					id?: string;
					name: string;
				};
				Update: {
					archived?: boolean;
					color?: string;
					created_at?: string;
					description?: string;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
			role_account: {
				Row: {
					account: string | null;
					archived: boolean;
					created_at: string;
					id: string;
					role: string | null;
				};
				ComputedFields: never;
				Insert: {
					account?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					role?: string | null;
				};
				Update: {
					account?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					role?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'role_account_role_fkey';
						columns: ['role'];
						isOneToOne: false;
						referencedRelation: 'role';
						referencedColumns: ['id'];
					}
				];
			};
			session: {
				Row: {
					account_id: string | null;
					archived: boolean;
					created_at: string;
					id: string;
					prev_url: string | null;
				};
				ComputedFields: never;
				Insert: {
					account_id?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					prev_url?: string | null;
				};
				Update: {
					account_id?: string | null;
					archived?: boolean;
					created_at?: string;
					id?: string;
					prev_url?: string | null;
				};
				Relationships: [];
			};
			session_tab: {
				Row: {
					archived: boolean;
					created_at: string;
					id: string;
					session_id: string;
					url: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					id?: string;
					session_id: string;
					url: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: string;
					session_id?: string;
					url?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'session_tab_session_id_fkey';
						columns: ['session_id'];
						isOneToOne: false;
						referencedRelation: 'session';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			has_role: { Args: { required_role: string }; Returns: boolean };
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			_template: {
				Row: {
					archived: boolean;
					created_at: string;
					id: string;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					id?: string;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			get_schemas_and_tables: {
				Args: Record<PropertyKey, never>;
				Returns: {
					schema_name: string;
					table_name: string;
				}[];
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	test: {
		Tables: {
			join_test: {
				Row: {
					archived: boolean;
					created_at: string;
					id: number;
					test_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					archived?: boolean;
					created_at?: string;
					id?: number;
					test_id?: string | null;
				};
				Update: {
					archived?: boolean;
					created_at?: string;
					id?: number;
					test_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'join_test_test_id_fkey';
						columns: ['test_id'];
						isOneToOne: false;
						referencedRelation: 'test';
						referencedColumns: ['id'];
					}
				];
			};
			test: {
				Row: {
					age: number;
					archived: boolean;
					created_at: string;
					id: string;
					name: string;
				};
				ComputedFields: never;
				Insert: {
					age: number;
					archived?: boolean;
					created_at?: string;
					id?: string;
					name: string;
				};
				Update: {
					age?: number;
					archived?: boolean;
					created_at?: string;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	budgeting: {
		Enums: {}
	},
	core: {
		Enums: {}
	},
	public: {
		Enums: {}
	},
	test: {
		Enums: {}
	}
} as const;

export type SchemaName = keyof Database;

export type DatabasePivoted = {
	Row: {
		budgeting: {
			asset: {
				archived: boolean;
				created_at: string;
				current_value: number;
				id: string;
				name: string;
			};
			bucket: {
				archived: boolean;
				balance: number;
				created_at: string;
				id: string;
				name: string;
			};
			budget: {
				archived: boolean;
				created_at: string;
				end_date: string;
				id: string;
				name: string;
				start_date: string;
				status: string;
			};
			budget_item: {
				archived: boolean;
				budget_id: string;
				category: string;
				created_at: string;
				id: string;
				planned_amount: number;
				rollover: boolean;
			};
			category: {
				archived: boolean;
				color: string | null;
				created_at: string;
				icon: string | null;
				id: string;
				kind: string;
				name: string;
				parent_id: string | null;
			};
			tags: {
				archived: boolean;
				color: string;
				created_at: string;
				id: string;
				name: string;
			};
			transaction: {
				amount: number;
				archived: boolean;
				bucket_id: string;
				category: string | null;
				created_at: string;
				description: string | null;
				id: string;
				transfer_sibling: string | null;
			};
			transaction_tag: {
				archived: boolean;
				created_at: string;
				id: string;
				tag_id: string | null;
				transaction_id: string | null;
			};
			transaction_transfer_dismissal: {
				archived: boolean;
				created_at: string;
				id: string;
				left_transaction_id: string;
				right_transaction_id: string;
			};
		};
		core: {
			account_notification: {
				account_id: string;
				archived: boolean;
				created_at: string;
				icon: string;
				icon_type: string;
				id: string;
				link: string | null;
				message: string;
				read: boolean;
				severity: string;
				title: string;
			};
			admin: {
				archived: boolean;
				created_at: string;
				id: string;
			};
			cached_request: {
				archived: boolean;
				created_at: string;
				headers: string;
				id: string;
				response: string;
				status: number;
				ttl: number;
				url: string;
			};
			profile: {
				archived: boolean;
				created_at: string;
				email: string;
				first_name: string;
				id: string;
				last_name: string;
				username: string;
			};
			role: {
				archived: boolean;
				color: string;
				created_at: string;
				description: string;
				id: string;
				name: string;
			};
			role_account: {
				account: string | null;
				archived: boolean;
				created_at: string;
				id: string;
				role: string | null;
			};
			session: {
				account_id: string | null;
				archived: boolean;
				created_at: string;
				id: string;
				prev_url: string | null;
			};
			session_tab: {
				archived: boolean;
				created_at: string;
				id: string;
				session_id: string;
				url: string;
			};
		};
		public: {
			_template: {
				archived: boolean;
				created_at: string;
				id: string;
			};
		};
		test: {
			join_test: {
				archived: boolean;
				created_at: string;
				id: number;
				test_id: string | null;
			};
			test: {
				age: number;
				archived: boolean;
				created_at: string;
				id: string;
				name: string;
			};
		};
	};
	Insert: {
		budgeting: {
			asset: {
				archived: boolean;
				created_at?: string;
				current_value: number;
				id?: string;
				name: string;
			};
			bucket: {
				archived?: boolean;
				balance: number;
				created_at?: string;
				id?: string;
				name: string;
			};
			budget: {
				archived?: boolean;
				created_at?: string;
				end_date: string;
				id?: string;
				name: string;
				start_date: string;
				status: string;
			};
			budget_item: {
				archived?: boolean;
				budget_id: string;
				category: string;
				created_at?: string;
				id?: string;
				planned_amount: number;
				rollover: boolean;
			};
			category: {
				archived?: boolean;
				color?: string | null;
				created_at?: string;
				icon?: string | null;
				id?: string;
				kind: string;
				name: string;
				parent_id?: string | null;
			};
			tags: {
				archived?: boolean;
				color: string;
				created_at?: string;
				id?: string;
				name: string;
			};
			transaction: {
				amount: number;
				archived?: boolean;
				bucket_id: string;
				category?: string | null;
				created_at?: string;
				description?: string | null;
				id?: string;
				transfer_sibling?: string | null;
			};
			transaction_tag: {
				archived: boolean;
				created_at?: string;
				id?: string;
				tag_id?: string | null;
				transaction_id?: string | null;
			};
			transaction_transfer_dismissal: {
				archived?: boolean;
				created_at?: string;
				id?: string;
				left_transaction_id: string;
				right_transaction_id: string;
			};
		};
		core: {
			account_notification: {
				account_id: string;
				archived?: boolean;
				created_at?: string;
				icon: string;
				icon_type: string;
				id?: string;
				link?: string | null;
				message: string;
				read?: boolean;
				severity: string;
				title: string;
			};
			admin: {
				archived?: boolean;
				created_at?: string;
				id?: string;
			};
			cached_request: {
				archived?: boolean;
				created_at?: string;
				headers: string;
				id?: string;
				response: string;
				status: number;
				ttl: number;
				url: string;
			};
			profile: {
				archived?: boolean;
				created_at?: string;
				email: string;
				first_name: string;
				id: string;
				last_name: string;
				username: string;
			};
			role: {
				archived?: boolean;
				color: string;
				created_at?: string;
				description: string;
				id?: string;
				name: string;
			};
			role_account: {
				account?: string | null;
				archived?: boolean;
				created_at?: string;
				id?: string;
				role?: string | null;
			};
			session: {
				account_id?: string | null;
				archived?: boolean;
				created_at?: string;
				id?: string;
				prev_url?: string | null;
			};
			session_tab: {
				archived?: boolean;
				created_at?: string;
				id?: string;
				session_id: string;
				url: string;
			};
		};
		public: {
			_template: {
				archived?: boolean;
				created_at?: string;
				id?: string;
			};
		};
		test: {
			join_test: {
				archived?: boolean;
				created_at?: string;
				id?: number;
				test_id?: string | null;
			};
			test: {
				age: number;
				archived?: boolean;
				created_at?: string;
				id?: string;
				name: string;
			};
		};
	};
	Update: {
		budgeting: {
			asset: {
				archived?: boolean;
				created_at?: string;
				current_value?: number;
				id?: string;
				name?: string;
			};
			bucket: {
				archived?: boolean;
				balance?: number;
				created_at?: string;
				id?: string;
				name?: string;
			};
			budget: {
				archived?: boolean;
				created_at?: string;
				end_date?: string;
				id?: string;
				name?: string;
				start_date?: string;
				status?: string;
			};
			budget_item: {
				archived?: boolean;
				budget_id?: string;
				category?: string;
				created_at?: string;
				id?: string;
				planned_amount?: number;
				rollover?: boolean;
			};
			category: {
				archived?: boolean;
				color?: string | null;
				created_at?: string;
				icon?: string | null;
				id?: string;
				kind?: string;
				name?: string;
				parent_id?: string | null;
			};
			tags: {
				archived?: boolean;
				color?: string;
				created_at?: string;
				id?: string;
				name?: string;
			};
			transaction: {
				amount?: number;
				archived?: boolean;
				bucket_id?: string;
				category?: string | null;
				created_at?: string;
				description?: string | null;
				id?: string;
				transfer_sibling?: string | null;
			};
			transaction_tag: {
				archived?: boolean;
				created_at?: string;
				id?: string;
				tag_id?: string | null;
				transaction_id?: string | null;
			};
			transaction_transfer_dismissal: {
				archived?: boolean;
				created_at?: string;
				id?: string;
				left_transaction_id?: string;
				right_transaction_id?: string;
			};
		};
		core: {
			account_notification: {
				account_id?: string;
				archived?: boolean;
				created_at?: string;
				icon?: string;
				icon_type?: string;
				id?: string;
				link?: string | null;
				message?: string;
				read?: boolean;
				severity?: string;
				title?: string;
			};
			admin: {
				archived?: boolean;
				created_at?: string;
				id?: string;
			};
			cached_request: {
				archived?: boolean;
				created_at?: string;
				headers?: string;
				id?: string;
				response?: string;
				status?: number;
				ttl?: number;
				url?: string;
			};
			profile: {
				archived?: boolean;
				created_at?: string;
				email?: string;
				first_name?: string;
				id?: string;
				last_name?: string;
				username?: string;
			};
			role: {
				archived?: boolean;
				color?: string;
				created_at?: string;
				description?: string;
				id?: string;
				name?: string;
			};
			role_account: {
				account?: string | null;
				archived?: boolean;
				created_at?: string;
				id?: string;
				role?: string | null;
			};
			session: {
				account_id?: string | null;
				archived?: boolean;
				created_at?: string;
				id?: string;
				prev_url?: string | null;
			};
			session_tab: {
				archived?: boolean;
				created_at?: string;
				id?: string;
				session_id?: string;
				url?: string;
			};
		};
		public: {
			_template: {
				archived?: boolean;
				created_at?: string;
				id?: string;
			};
		};
		test: {
			join_test: {
				archived?: boolean;
				created_at?: string;
				id?: number;
				test_id?: string | null;
			};
			test: {
				age?: number;
				archived?: boolean;
				created_at?: string;
				id?: string;
				name?: string;
			};
		};
	};
	Relationships: {
		budgeting: {
			asset: Database['budgeting']['Tables']['asset']['Relationships'];
			bucket: Database['budgeting']['Tables']['bucket']['Relationships'];
			budget: Database['budgeting']['Tables']['budget']['Relationships'];
			budget_item: Database['budgeting']['Tables']['budget_item']['Relationships'];
			category: Database['budgeting']['Tables']['category']['Relationships'];
			tags: Database['budgeting']['Tables']['tags']['Relationships'];
			transaction: Database['budgeting']['Tables']['transaction']['Relationships'];
			transaction_tag: Database['budgeting']['Tables']['transaction_tag']['Relationships'];
			transaction_transfer_dismissal: Database['budgeting']['Tables']['transaction_transfer_dismissal']['Relationships'];
		};
		core: {
			account_notification: Database['core']['Tables']['account_notification']['Relationships'];
			admin: Database['core']['Tables']['admin']['Relationships'];
			cached_request: Database['core']['Tables']['cached_request']['Relationships'];
			profile: Database['core']['Tables']['profile']['Relationships'];
			role: Database['core']['Tables']['role']['Relationships'];
			role_account: Database['core']['Tables']['role_account']['Relationships'];
			session: Database['core']['Tables']['session']['Relationships'];
			session_tab: Database['core']['Tables']['session_tab']['Relationships'];
		};
		public: {
			_template: Database['public']['Tables']['_template']['Relationships'];
		};
		test: {
			join_test: Database['test']['Tables']['join_test']['Relationships'];
			test: Database['test']['Tables']['test']['Relationships'];
		};
	};
};

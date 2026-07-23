import SwiftUI

struct AgentChatView: View {
    @EnvironmentObject var ideManager: IDEManager
    @StateObject private var viewModel = AgentChatViewModel()

    @State private var inputText = ""
    @AppStorage("archon.agent.workspacePath") private var workspacePath = ""

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(IDETheme.borderFaint)
            content
            Divider().overlay(IDETheme.borderFaint)
            composer
        }
        .background(IDETheme.base)
        .task { await viewModel.loadInitialState() }
        .onDisappear { viewModel.stop() }
        .onReceive(viewModel.$events) { newEvents in
            ideManager.agentMessages = newEvents
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 8) {
            Text("Archon Agent")
                .font(.headline)
                .fontDesign(.rounded)
                .foregroundStyle(IDETheme.text)
                .accessibilityAddTraits(.isHeader)

            Spacer()

            if let task = viewModel.task {
                // Provider/model come from backend task metadata — never
                // hard-coded in the client.
                Text("\(task.provider) · \(task.model)")
                    .font(.caption2)
                    .fontDesign(.rounded)
                    .foregroundStyle(IDETheme.textSub)
                    .lineLimit(1)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(IDETheme.elevated)
                    .clipShape(Capsule())
                    .accessibilityLabel("Model: \(task.provider), \(task.model)")

                statusChip(task.status)
            } else if !viewModel.usableProviders.isEmpty {
                providerPicker
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(IDETheme.surface)
    }

    private var providerPicker: some View {
        Menu {
            ForEach(viewModel.usableProviders) { provider in
                ForEach(provider.models, id: \.id) { model in
                    Button("\(provider.name) — \(model.name)") {
                        viewModel.selectedProviderId = provider.id
                        viewModel.selectedModelId = model.id
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "cpu")
                    .font(.caption2)
                Text(selectedModelLabel)
                    .font(.caption2)
                    .fontDesign(.rounded)
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 8))
            }
            .foregroundStyle(IDETheme.textSub)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(IDETheme.elevated)
            .clipShape(Capsule())
        }
        .accessibilityLabel("Server-Configured Providers. Current: \(selectedModelLabel)")
        .ideTouchTarget()
    }

    private var selectedModelLabel: String {
        guard let provider = viewModel.selectedProvider else { return "Server-Configured Providers" }
        let model = provider.models.first { $0.id == viewModel.selectedModelId }
        return model.map { "\(provider.name) · \($0.name)" } ?? provider.name
    }

    private func statusChip(_ status: TaskStatus) -> some View {
        Text(status.rawValue.capitalized)
            .font(.caption2.weight(.semibold))
            .fontDesign(.rounded)
            .foregroundStyle(statusColor(status))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor(status).opacity(0.15))
            .clipShape(Capsule())
            .accessibilityLabel("Task status: \(status.rawValue)")
    }

    private func statusColor(_ status: TaskStatus) -> Color {
        switch status {
        case .completed:                return IDETheme.success
        case .failed, .cancelled:       return IDETheme.danger
        case .blocked, .cancelling:     return IDETheme.warning
        case .queued, .planning, .running, .verifying:
            return IDETheme.accent
        }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        Group {
            if let error = viewModel.errorMessage {
                errorBanner(error)
            }

            if viewModel.isLoading && viewModel.task == nil {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading tasks…")
                        .font(.caption)
                        .fontDesign(.rounded)
                        .foregroundStyle(IDETheme.textSub)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.events.isEmpty {
                emptyState
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if let task = viewModel.task {
                            taskSummaryRow(task)
                        }
                        EventTimelineView(events: viewModel.events)
                    }
                    .padding()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(IDETheme.base)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 36))
                .foregroundStyle(IDETheme.textMuted)
            Text(viewModel.task == nil
                 ? "No agent tasks yet"
                 : "Waiting for the first event from the agent…")
                .font(.subheadline)
                .fontDesign(.rounded)
                .foregroundStyle(IDETheme.textSub)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .accessibilityElement(children: .combine)
    }

    private func taskSummaryRow(_ task: ArchonTask) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(task.title)
                .font(.subheadline.weight(.semibold))
                .fontDesign(.rounded)
                .foregroundStyle(IDETheme.text)
            Text("Step \(task.currentStep) of \(task.maxSteps) · \(task.creditsUsed)/\(task.creditLimit) credits")
                .font(.caption2)
                .fontDesign(.rounded)
                .foregroundStyle(IDETheme.textSub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(IDETheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.caption)
                .foregroundStyle(IDETheme.warning)
            Text(message)
                .font(.caption)
                .fontDesign(.rounded)
                .foregroundStyle(IDETheme.text)
            Spacer()
            Button {
                viewModel.errorMessage = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(IDETheme.textSub)
            }
            .accessibilityLabel("Dismiss error")
            .ideTouchTarget()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(IDETheme.warning.opacity(0.12))
    }

    // MARK: Composer

    private var composer: some View {
        VStack(spacing: 8) {
            if workspacePath.isEmpty {
                workspacePathField
            }

            HStack(spacing: 8) {
                TextField("Describe a coding task…", text: $inputText, axis: .vertical)
                    .font(.callout)
                    .fontDesign(.rounded)
                    .foregroundStyle(IDETheme.text)
                    .lineLimit(1...4)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(IDETheme.elevated)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                if viewModel.isTaskActive {
                    Button {
                        Task { await viewModel.cancelActiveTask() }
                    } label: {
                        Image(systemName: "stop.circle.fill")
                            .font(.title2)
                            .foregroundStyle(IDETheme.danger)
                    }
                    .accessibilityLabel("Cancel running task")
                    .ideTouchTarget()
                } else {
                    Button {
                        let text = inputText
                        inputText = ""
                        Task { await viewModel.send(request: text, workspacePath: workspacePath) }
                    } label: {
                        if viewModel.isSubmitting {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title2)
                                .foregroundStyle(canSend ? IDETheme.accent : IDETheme.textMuted)
                        }
                    }
                    .disabled(!canSend || viewModel.isSubmitting)
                    .accessibilityLabel("Start agent task")
                    .ideTouchTarget()
                }
            }
        }
        .padding(12)
        .background(IDETheme.surface)
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !workspacePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && viewModel.selectedProviderId != nil
    }

    private var workspacePathField: some View {
        HStack(spacing: 8) {
            Image(systemName: "folder.badge.gearshape")
                .font(.caption)
                .foregroundStyle(IDETheme.textSub)
            TextField("Server workspace path (required)", text: $workspacePath)
                .font(.caption)
                .fontDesign(.monospaced)
                .foregroundStyle(IDETheme.text)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(IDETheme.elevated)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityHint("Tasks run against this directory on the Archon server.")
    }
}

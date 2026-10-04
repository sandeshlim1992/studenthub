# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

namespace :studenthub do
  namespace :feedback do
    desc 'Import feedback_tokens.json from the old PHP feedback add-on. Usage: rails "studenthub:feedback:import[path/to/feedback_tokens.json]"'
    task :import, [:path] => :environment do |_task, args|
      path = args[:path].presence || abort('Usage: rails "studenthub:feedback:import[path/to/feedback_tokens.json]"')
      abort "File not found: #{path}" if !File.exist?(path)

      result = Service::FeedbackCollection::ImportLegacy.execute(json: File.read(path))

      puts "Imported #{result[:imported]} requests (#{result[:submitted]} with a rating, #{result[:unused]} unused links)."
      puts "Matched to existing tickets: #{result[:matched_tickets]}."
      puts "Already imported before, skipped: #{result[:skipped_existing]}."
      if result[:errors].any?
        puts "Failed: #{result[:errors].size}"
        result[:errors].first(20).each { |error| puts "  #{error}" }
      end
    end
  end
end

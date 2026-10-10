# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# A department (Studenthub::Departments): a name, the campuses it covers (`locations`, values of
# the ticket's Campus field) and one email address.
class StudenthubDepartment < ApplicationModel
  before_validation :tidy

  validate :name_given_and_unique
  validate :email_valid
  validate :locations_are_campuses

  # Campuses it covers that the Campus field no longer has (an admin changed the field).
  def missing_locations
    Array(locations) - Studenthub::Departments.campus_values
  end

  private

  def tidy
    self.name      = name.to_s.squish.first(150)
    self.email     = email.to_s.strip.downcase
    self.locations = Array(locations).map { |location| location.to_s.strip }.compact_blank.uniq
  end

  def name_given_and_unique
    return errors.add(:base, __('Enter a name.')) if name.blank?

    taken = self.class.where.not(id: id).exists?(['LOWER(name) = ?', name.downcase])
    errors.add(:base, format(__('%s already exists.'), name)) if taken
  end

  def email_valid
    return errors.add(:base, __('Enter an email address.')) if email.blank?

    errors.add(:base, format(__('%s is not a valid email address.'), email)) if !EmailAddressValidation.new(email).valid?
  end

  # At least one campus; a newly chosen one must be a campus now. Campuses an admin later removed
  # from the field stay until someone takes them out (see missing_locations).
  def locations_are_campuses
    return errors.add(:base, __('Choose at least one location.')) if locations.blank?

    added   = locations - Array(locations_was)
    unknown = added - Studenthub::Departments.campus_values
    errors.add(:base, format(__('%s is not a campus.'), unknown.join(', '))) if unknown.present?
  end
end
